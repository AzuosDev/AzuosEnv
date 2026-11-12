import { BadRequestException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage } from '../../common/pagination/cursor';
import { RecentsService } from '../favorites/recents.service';
import { CreateListDto, ListQueryDto, MoveListDto, UpdateListDto } from './dto/list.dto';
import { ReorderDto } from './dto/reorder.dto';
import { LIST_CREATED, HierarchyCreatedEvent } from './hierarchy-events';
import { HierarchyAccessService } from './hierarchy-access.service';
import {
  appendPosition,
  paginateByPosition,
  positionBetweenSiblings,
  positionedModel,
} from './ordering';
import { PermissionContext, PermissionService } from './permission.service';
import { FolderDocument } from './schemas/folder.schema';
import { List, ListDocument } from './schemas/list.schema';
import { SpaceDocument } from './schemas/space.schema';
import { EffectiveStatuses, StatusSetsService } from './status-sets.service';

@Injectable()
export class ListsService {
  constructor(
    @InjectModel(List.name) private readonly model: Model<List>,
    private readonly access: HierarchyAccessService,
    private readonly statusSets: StatusSetsService,
    private readonly permissions: PermissionService,
    private readonly recents: RecentsService,
    private readonly events: EventEmitter2,
  ) {}

  async create(ctx: PermissionContext, dto: CreateListDto): Promise<ListDocument> {
    const space = await this.access.requireSpace(ctx, new Types.ObjectId(dto.spaceId), 'edit');
    const folder = dto.folderId
      ? await this.requireFolderOfSpace(ctx, new Types.ObjectId(dto.folderId), space)
      : null;

    const list = await this.model.create({
      workspaceId: ctx.workspaceId,
      spaceId: space._id,
      folderId: folder?._id ?? null,
      name: dto.name,
      color: dto.color,
      description: dto.description,
      statusSetId: dto.statusSetId
        ? await this.statusSets.requireOwned(ctx.workspaceId, dto.statusSetId)
        : null,
      position: await appendPosition(
        positionedModel(this.model),
        this.siblings(ctx, space._id, folder?._id ?? null),
      ),
    });

    await this.events.emitAsync(LIST_CREATED, {
      workspaceId: ctx.workspaceId,
      resourceType: 'list',
      resourceId: list._id,
      actorId: ctx.userId,
    } satisfies HierarchyCreatedEvent);

    return list;
  }

  async list(ctx: PermissionContext, query: ListQueryDto): Promise<CursorPage<ListDocument>> {
    const docs = await this.model.find(this.listFilter(ctx, query)).sort({ position: 1 }).exec();

    const explicit = await this.permissions.explicitLevels(ctx);
    const visible: ListDocument[] = [];

    for (const doc of docs) {
      const chain = await this.access.listChain(doc);

      if (this.permissions.canView(this.permissions.levelFromChain(ctx, chain, explicit))) {
        visible.push(doc);
      }
    }

    return paginateByPosition(visible, query);
  }

  async get(ctx: PermissionContext, listId: Types.ObjectId): Promise<ListDocument> {
    const list = await this.access.requireList(ctx, listId, 'view');

    await this.recents.record(ctx, 'list', list._id);

    return list;
  }

  /** Effective statuses of the List (list -> folder -> space). */
  async statuses(ctx: PermissionContext, listId: Types.ObjectId): Promise<EffectiveStatuses> {
    const list = await this.access.requireList(ctx, listId, 'view');

    return this.statusSets.resolveForList(list);
  }

  async update(
    ctx: PermissionContext,
    listId: Types.ObjectId,
    dto: UpdateListDto,
  ): Promise<ListDocument> {
    const required = dto.statusSetId !== undefined ? 'full' : 'edit';
    const list = await this.access.requireList(ctx, listId, required);

    if (dto.name !== undefined) {
      list.name = dto.name;
    }

    if (dto.color !== undefined) {
      list.color = dto.color;
    }

    if (dto.description !== undefined) {
      list.description = dto.description;
    }

    if (dto.statusSetId !== undefined) {
      list.statusSetId = dto.statusSetId
        ? await this.statusSets.requireOwned(ctx.workspaceId, dto.statusSetId)
        : null;
    }

    return list.save();
  }

  async move(
    ctx: PermissionContext,
    listId: Types.ObjectId,
    dto: MoveListDto,
  ): Promise<ListDocument> {
    const list = await this.access.requireList(ctx, listId, 'edit');
    const space = await this.access.requireSpace(
      ctx,
      dto.spaceId ? new Types.ObjectId(dto.spaceId) : list.spaceId,
      'edit',
    );

    const folderId =
      dto.folderId === undefined
        ? list.folderId
        : dto.folderId === null
          ? null
          : new Types.ObjectId(dto.folderId);

    const folder = folderId ? await this.requireFolderOfSpace(ctx, folderId, space) : null;

    list.spaceId = space._id;
    list.folderId = folder?._id ?? null;
    list.position = await appendPosition(
      positionedModel(this.model),
      this.siblings(ctx, space._id, folder?._id ?? null),
    );

    return list.save();
  }

  async archive(ctx: PermissionContext, listId: Types.ObjectId): Promise<ListDocument> {
    const list = await this.access.requireList(ctx, listId, 'edit');

    list.archivedAt ??= new Date();

    return list.save();
  }

  async unarchive(ctx: PermissionContext, listId: Types.ObjectId): Promise<ListDocument> {
    const list = await this.access.requireList(ctx, listId, 'edit');

    list.archivedAt = null;

    return list.save();
  }

  async remove(ctx: PermissionContext, listId: Types.ObjectId): Promise<void> {
    const list = await this.access.requireList(ctx, listId, 'full');

    list.deletedAt = new Date();
    await list.save();
  }

  async restore(ctx: PermissionContext, listId: Types.ObjectId): Promise<ListDocument> {
    const list = await this.access.requireList(ctx, listId, 'full', { includeDeleted: true });

    list.deletedAt = null;

    return list.save();
  }

  async reorder(
    ctx: PermissionContext,
    listId: Types.ObjectId,
    dto: ReorderDto,
  ): Promise<ListDocument> {
    const list = await this.access.requireList(ctx, listId, 'edit');

    list.position = await positionBetweenSiblings(
      positionedModel(this.model),
      this.siblings(ctx, list.spaceId, list.folderId),
      dto.previousId ? new Types.ObjectId(dto.previousId) : null,
      dto.nextId ? new Types.ObjectId(dto.nextId) : null,
    );

    return list.save();
  }

  private async requireFolderOfSpace(
    ctx: PermissionContext,
    folderId: Types.ObjectId,
    space: SpaceDocument,
  ): Promise<FolderDocument> {
    const folder = await this.access.requireFolder(ctx, folderId, 'edit');

    if (String(folder.spaceId) !== String(space._id)) {
      throw new BadRequestException({
        code: 'INVALID_FOLDER_PARENT',
        message: 'O folder deve estar no mesmo Space da List.',
      });
    }

    return folder;
  }

  private siblings(
    ctx: PermissionContext,
    spaceId: Types.ObjectId,
    folderId: Types.ObjectId | null,
  ): Record<string, unknown> {
    return { workspaceId: ctx.workspaceId, spaceId, folderId, deletedAt: null };
  }

  private listFilter(ctx: PermissionContext, query: ListQueryDto): Record<string, unknown> {
    const filter: Record<string, unknown> = {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
    };

    if (query.spaceId) {
      filter.spaceId = new Types.ObjectId(query.spaceId);
    }

    if (!query.includeArchived) {
      filter.archivedAt = null;
    }

    if (query.folderId) {
      filter.folderId = new Types.ObjectId(query.folderId);
    }

    return filter;
  }
}
