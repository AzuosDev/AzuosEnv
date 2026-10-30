import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage, buildCursorPage, decodeObjectIdCursor } from '../../common/pagination/cursor';
import {
  DEFAULT_PAGE_SIZE,
  PaginationQueryDto,
} from '../../common/pagination/pagination-query.dto';
import { CreateStatusSetDto, StatusDto, UpdateStatusSetDto } from './dto/status-set.dto';
import { STATUS_SET_UPDATED, StatusSetUpdatedEvent } from './hierarchy-events';
import { Folder } from './schemas/folder.schema';
import { List, ListDocument } from './schemas/list.schema';
import { Space } from './schemas/space.schema';
import { Status, StatusSet, StatusSetDocument } from './schemas/status-set.schema';
import { STATUS_TEMPLATE_PRESETS, StatusTemplate } from './status-templates';

/** Where the statuses of a List come from: list -> folder -> space. */
export type StatusSource = 'list' | 'folder' | 'space';

export interface EffectiveStatuses {
  statusSetId: Types.ObjectId;
  name: string;
  source: StatusSource;
  statuses: Status[];
}

@Injectable()
export class StatusSetsService {
  constructor(
    @InjectModel(StatusSet.name) private readonly model: Model<StatusSet>,
    @InjectModel(Space.name) private readonly spaces: Model<Space>,
    @InjectModel(Folder.name) private readonly folders: Model<Folder>,
    @InjectModel(List.name) private readonly lists: Model<List>,
    private readonly events: EventEmitter2,
  ) {}

  async create(workspaceId: Types.ObjectId, dto: CreateStatusSetDto): Promise<StatusSetDocument> {
    return this.model.create({
      workspaceId,
      name: dto.name,
      statuses: toStatuses(dto.statuses),
    });
  }

  /** Status set with the statuses of a template; used when a Space is created. */
  async createFromTemplate(
    workspaceId: Types.ObjectId,
    template: StatusTemplate,
    name?: string,
  ): Promise<StatusSetDocument> {
    const preset = STATUS_TEMPLATE_PRESETS[template];

    return this.model.create({
      workspaceId,
      name: name ?? preset.name,
      statuses: toStatuses(preset.statuses),
    });
  }

  async list(
    workspaceId: Types.ObjectId,
    query: PaginationQueryDto,
  ): Promise<CursorPage<StatusSetDocument>> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const filter = query.cursor
      ? { workspaceId, _id: { $gt: decodeObjectIdCursor(query.cursor) } }
      : { workspaceId };

    const docs = await this.model
      .find(filter)
      .sort({ _id: 1 })
      .limit(limit + 1)
      .exec();

    return buildCursorPage(docs, limit, (doc) => ({ id: String(doc._id) }));
  }

  async get(workspaceId: Types.ObjectId, statusSetId: Types.ObjectId): Promise<StatusSetDocument> {
    const statusSet = await this.model.findOne({ _id: statusSetId, workspaceId }).exec();

    if (!statusSet) {
      throw new NotFoundException({
        code: 'STATUS_SET_NOT_FOUND',
        message: 'Conjunto de statuses não encontrado.',
      });
    }

    return statusSet;
  }

  async update(
    workspaceId: Types.ObjectId,
    statusSetId: Types.ObjectId,
    dto: UpdateStatusSetDto,
  ): Promise<StatusSetDocument> {
    const statusSet = await this.get(workspaceId, statusSetId);

    if (dto.name !== undefined) {
      statusSet.name = dto.name;
    }

    if (dto.statuses !== undefined) {
      statusSet.statuses = toStatuses(dto.statuses);
    }

    await statusSet.save();

    if (dto.statuses !== undefined) {
      this.events.emit(STATUS_SET_UPDATED, {
        workspaceId,
        statusSetId: statusSet._id,
        statuses: statusSet.statuses.map((status) => ({
          statusId: status._id,
          group: status.group,
        })),
      } satisfies StatusSetUpdatedEvent);
    }

    return statusSet;
  }

  /** Every status of the workspace by id, used for labels and denormalization. */
  async statusIndex(
    workspaceId: Types.ObjectId,
  ): Promise<Map<string, { name: string; position: number; group: Status['group'] }>> {
    const sets = await this.model.find({ workspaceId }).select('statuses').exec();
    const index = new Map<string, { name: string; position: number; group: Status['group'] }>();

    for (const set of sets) {
      for (const status of set.statuses) {
        index.set(String(status._id), {
          name: status.name,
          position: status.position,
          group: status.group,
        });
      }
    }

    return index;
  }

  /** A status set still in use by a Space, Folder or List cannot be removed. */
  async remove(workspaceId: Types.ObjectId, statusSetId: Types.ObjectId): Promise<void> {
    const statusSet = await this.get(workspaceId, statusSetId);
    const filter = { workspaceId, statusSetId, deletedAt: null };
    const usage = await Promise.all([
      this.spaces.countDocuments(filter).exec(),
      this.folders.countDocuments(filter).exec(),
      this.lists.countDocuments(filter).exec(),
    ]);

    if (usage.some((count) => count > 0)) {
      throw new ConflictException({
        code: 'STATUS_SET_IN_USE',
        message: 'Este conjunto de statuses está em uso.',
      });
    }

    await statusSet.deleteOne();
  }

  /** Validates that the status set belongs to the workspace. */
  async requireOwned(workspaceId: Types.ObjectId, statusSetId: string): Promise<Types.ObjectId> {
    const exists = await this.model
      .countDocuments({ _id: new Types.ObjectId(statusSetId), workspaceId })
      .exec();

    if (exists === 0) {
      throw new BadRequestException({
        code: 'INVALID_STATUS_SET',
        message: 'Conjunto de statuses inválido para este workspace.',
      });
    }

    return new Types.ObjectId(statusSetId);
  }

  /** Effective statuses of a List: its own set, else the folder chain, else the Space. */
  async resolveForList(list: ListDocument): Promise<EffectiveStatuses> {
    const candidates: { id: Types.ObjectId; source: StatusSource }[] = [];

    if (list.statusSetId) {
      candidates.push({ id: list.statusSetId, source: 'list' });
    }

    for (const folder of await this.folderAncestors(list)) {
      if (folder.statusSetId) {
        candidates.push({ id: folder.statusSetId, source: 'folder' });
      }
    }

    const space = await this.spaces
      .findOne({ _id: list.spaceId, workspaceId: list.workspaceId })
      .exec();

    if (space) {
      candidates.push({ id: space.statusSetId, source: 'space' });
    }

    for (const candidate of candidates) {
      const statusSet = await this.model
        .findOne({ _id: candidate.id, workspaceId: list.workspaceId })
        .exec();

      if (statusSet) {
        return {
          statusSetId: statusSet._id,
          name: statusSet.name,
          source: candidate.source,
          statuses: [...statusSet.statuses].sort((a, b) => a.position - b.position),
        };
      }
    }

    throw new NotFoundException({
      code: 'STATUS_SET_NOT_FOUND',
      message: 'Conjunto de statuses não encontrado.',
    });
  }

  /** From the closest folder to the outermost one. */
  private async folderAncestors(list: ListDocument) {
    const chain = [];
    let current = list.folderId
      ? await this.folders.findOne({ _id: list.folderId, workspaceId: list.workspaceId }).exec()
      : null;

    while (current) {
      chain.push(current);
      current = current.parentFolderId
        ? await this.folders
            .findOne({ _id: current.parentFolderId, workspaceId: list.workspaceId })
            .exec()
        : null;
    }

    return chain;
  }
}

function toStatuses(
  statuses: (StatusDto | { name: string; color: string; group: Status['group'] })[],
): Status[] {
  return statuses.map((status, index) => ({
    _id: 'id' in status && status.id ? new Types.ObjectId(status.id) : new Types.ObjectId(),
    name: status.name,
    color: status.color,
    group: status.group,
    position: index,
  }));
}
