import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage, buildCursorPage, decodeObjectIdCursor } from '../../common/pagination/cursor';
import { DEFAULT_PAGE_SIZE } from '../../common/pagination/pagination-query.dto';
import { FoldersService } from '../hierarchy/folders.service';
import { HierarchyAccessService } from '../hierarchy/hierarchy-access.service';
import { ListsService } from '../hierarchy/lists.service';
import { PermissionContext } from '../hierarchy/permission.service';
import { List, ListDocument } from '../hierarchy/schemas/list.schema';
import { Task } from '../tasks/schemas/task.schema';
import { TasksService } from '../tasks/tasks.service';
import {
  CreateSprintDto,
  CreateSprintFolderDto,
  SprintFolderQueryDto,
  UpdateSprintFolderDto,
} from './dto/sprint.dto';
import {
  CLOSED_STATUS_GROUPS,
  DAY_MS,
  DEFAULT_SPRINT_DURATION_DAYS,
  MAX_SPRINTS_PER_FOLDER,
  MAX_SPRINT_MOVE,
} from './sprint-fields';
import { SprintFolder, SprintFolderDocument } from './schemas/sprint-folder.schema';

export interface SprintFolderView {
  sprintFolder: SprintFolderDocument;
  sprints: ListDocument[];
}

export interface CloseSprintResult {
  sprint: ListDocument;
  nextSprint: ListDocument;
  moved: number;
}

/**
 * ClickApp sprints: a sprint folder is a Folder of the hierarchy and each sprint
 * inside it is a List with a start and an end date. Closing a sprint pushes what
 * is still open into the next one, creating it when it does not exist yet.
 */
@Injectable()
export class SprintsService {
  constructor(
    @InjectModel(SprintFolder.name) private readonly model: Model<SprintFolder>,
    @InjectModel(List.name) private readonly lists: Model<List>,
    @InjectModel(Task.name) private readonly tasks: Model<Task>,
    private readonly folders: FoldersService,
    private readonly listsService: ListsService,
    private readonly tasksService: TasksService,
    private readonly hierarchy: HierarchyAccessService,
  ) {}

  sprintFolderNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'SPRINT_FOLDER_NOT_FOUND',
      message: 'Pasta de sprints não encontrada.',
    });
  }

  sprintNotFound(): NotFoundException {
    return new NotFoundException({ code: 'SPRINT_NOT_FOUND', message: 'Sprint não encontrada.' });
  }

  /** Creates the Folder of the hierarchy, the settings and the first sprint. */
  async createFolder(
    ctx: PermissionContext,
    dto: CreateSprintFolderDto,
  ): Promise<SprintFolderView> {
    const startDate = this.requireDate(dto.startDate);
    const folder = await this.folders.create(ctx, { spaceId: dto.spaceId, name: dto.name });
    const sprintFolder = await this.model.create({
      workspaceId: ctx.workspaceId,
      spaceId: folder.spaceId,
      folderId: folder._id,
      name: dto.name,
      durationDays: dto.durationDays ?? DEFAULT_SPRINT_DURATION_DAYS,
      startDate,
      createdBy: ctx.userId,
    });
    const first = await this.createSprint(ctx, sprintFolder._id, {});

    return { sprintFolder, sprints: [first] };
  }

  async listFolders(
    ctx: PermissionContext,
    query: SprintFolderQueryDto,
  ): Promise<CursorPage<SprintFolderDocument>> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const filter: Record<string, unknown> = { workspaceId: ctx.workspaceId, deletedAt: null };

    if (query.cursor) {
      filter._id = { $lt: decodeObjectIdCursor(query.cursor) };
    }

    const docs = await this.model
      .find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .exec();
    const visible: SprintFolderDocument[] = [];

    for (const folder of docs) {
      if (await this.canSee(ctx, folder)) {
        visible.push(folder);
      }
    }

    return buildCursorPage(visible, limit, (doc) => ({ id: String(doc._id) }));
  }

  async getFolder(
    ctx: PermissionContext,
    sprintFolderId: Types.ObjectId,
  ): Promise<SprintFolderView> {
    const sprintFolder = await this.requireFolder(ctx, sprintFolderId, 'view');

    return { sprintFolder, sprints: await this.sprintsOf(sprintFolder) };
  }

  async updateFolder(
    ctx: PermissionContext,
    sprintFolderId: Types.ObjectId,
    dto: UpdateSprintFolderDto,
  ): Promise<SprintFolderDocument> {
    const sprintFolder = await this.requireFolder(ctx, sprintFolderId, 'edit');

    if (dto.name !== undefined) {
      sprintFolder.name = dto.name;
      await this.folders.update(ctx, sprintFolder.folderId, { name: dto.name });
    }

    if (dto.durationDays !== undefined) {
      sprintFolder.durationDays = dto.durationDays;
    }

    return sprintFolder.save();
  }

  /** Drops the settings and sends the Folder of the hierarchy to the trash. */
  async removeFolder(ctx: PermissionContext, sprintFolderId: Types.ObjectId): Promise<void> {
    const sprintFolder = await this.requireFolder(ctx, sprintFolderId, 'full');

    sprintFolder.deletedAt = new Date();
    await sprintFolder.save();
    await this.folders.remove(ctx, sprintFolder.folderId);
  }

  /** The next sprint of the folder, right after the end of the last one. */
  async createSprint(
    ctx: PermissionContext,
    sprintFolderId: Types.ObjectId,
    dto: CreateSprintDto,
  ): Promise<ListDocument> {
    const sprintFolder = await this.requireFolder(ctx, sprintFolderId, 'edit');
    const sprints = await this.sprintsOf(sprintFolder);

    if (sprints.length >= MAX_SPRINTS_PER_FOLDER) {
      throw new BadRequestException({
        code: 'INVALID_SPRINT',
        message: 'A pasta já tem o número máximo de sprints.',
      });
    }

    const last = sprints[sprints.length - 1];
    const startDate = dto.startDate
      ? this.requireDate(dto.startDate)
      : last?.endDate
        ? new Date(last.endDate.getTime() + DAY_MS)
        : sprintFolder.startDate;
    const endDate = new Date(startDate.getTime() + (sprintFolder.durationDays - 1) * DAY_MS);
    const list = await this.listsService.create(ctx, {
      spaceId: String(sprintFolder.spaceId),
      folderId: String(sprintFolder.folderId),
      name: dto.name ?? `Sprint ${sprints.length + 1}`,
    });

    list.sprintFolderId = sprintFolder._id;
    list.startDate = startDate;
    list.endDate = endDate;

    return list.save();
  }

  /** The sprint as a List; an ordinary List is not a sprint. */
  async getSprint(ctx: PermissionContext, sprintId: Types.ObjectId): Promise<ListDocument> {
    const list = await this.hierarchy.requireList(ctx, sprintId, 'view').catch(() => null);

    if (!list?.sprintFolderId) {
      throw this.sprintNotFound();
    }

    return list;
  }

  /**
   * Closes the sprint and moves everything that is not done to the next sprint of
   * the folder, which is created when the closed one is the last.
   */
  async closeSprint(ctx: PermissionContext, sprintId: Types.ObjectId): Promise<CloseSprintResult> {
    const sprint = await this.getSprint(ctx, sprintId);

    await this.hierarchy.requireList(ctx, sprint._id, 'edit');

    const sprintFolder = await this.requireFolder(
      ctx,
      sprint.sprintFolderId as Types.ObjectId,
      'edit',
    );
    const next = await this.nextSprintOf(ctx, sprintFolder, sprint);
    const pending = await this.tasks
      .find({
        workspaceId: ctx.workspaceId,
        listId: sprint._id,
        statusGroup: { $nin: [...CLOSED_STATUS_GROUPS] },
        deletedAt: null,
        archivedAt: null,
      })
      .select('_id')
      .limit(MAX_SPRINT_MOVE)
      .exec();

    for (const task of pending) {
      await this.tasksService.move(ctx, String(task._id), { listId: String(next._id) });
    }

    sprint.sprintClosedAt ??= new Date();
    await sprint.save();

    return { sprint, nextSprint: next, moved: pending.length };
  }

  /** Sprints of the folder, oldest first. */
  private sprintsOf(sprintFolder: SprintFolderDocument): Promise<ListDocument[]> {
    return this.lists
      .find({
        workspaceId: sprintFolder.workspaceId,
        sprintFolderId: sprintFolder._id,
        deletedAt: null,
      })
      .sort({ startDate: 1, _id: 1 })
      .limit(MAX_SPRINTS_PER_FOLDER)
      .exec();
  }

  private async nextSprintOf(
    ctx: PermissionContext,
    sprintFolder: SprintFolderDocument,
    sprint: ListDocument,
  ): Promise<ListDocument> {
    const sprints = await this.sprintsOf(sprintFolder);
    const index = sprints.findIndex((one) => String(one._id) === String(sprint._id));
    const next = index >= 0 ? sprints[index + 1] : undefined;

    return next ?? (await this.createSprint(ctx, sprintFolder._id, {}));
  }

  private async requireFolder(
    ctx: PermissionContext,
    sprintFolderId: Types.ObjectId,
    level: 'view' | 'edit' | 'full',
  ): Promise<SprintFolderDocument> {
    const sprintFolder = await this.model
      .findOne({ _id: sprintFolderId, workspaceId: ctx.workspaceId, deletedAt: null })
      .exec();

    if (!sprintFolder) {
      throw this.sprintFolderNotFound();
    }

    try {
      await this.hierarchy.requireFolder(ctx, sprintFolder.folderId, level);
    } catch {
      throw this.sprintFolderNotFound();
    }

    return sprintFolder;
  }

  private async canSee(
    ctx: PermissionContext,
    sprintFolder: SprintFolderDocument,
  ): Promise<boolean> {
    try {
      await this.hierarchy.requireFolder(ctx, sprintFolder.folderId, 'view');

      return true;
    } catch {
      return false;
    }
  }

  private requireDate(value: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_SPRINT',
        message: 'Informe uma data válida para a sprint.',
      });
    }

    return date;
  }
}
