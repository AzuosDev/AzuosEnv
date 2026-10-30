import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage, buildCursorPage, decodeCursor } from '../../common/pagination/cursor';
import {
  DEFAULT_PAGE_SIZE,
  PaginationQueryDto,
} from '../../common/pagination/pagination-query.dto';
import { FoldersService } from '../hierarchy/folders.service';
import { HierarchyAccessService } from '../hierarchy/hierarchy-access.service';
import { ListsService } from '../hierarchy/lists.service';
import { PermissionContext, PermissionService, ResourceRef } from '../hierarchy/permission.service';
import { Folder, FolderDocument } from '../hierarchy/schemas/folder.schema';
import { List, ListDocument } from '../hierarchy/schemas/list.schema';
import { Space, SpaceDocument } from '../hierarchy/schemas/space.schema';
import { SpacesService } from '../hierarchy/spaces.service';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';
import { TaskAccessService } from '../tasks/task-access.service';
import { TasksService } from '../tasks/tasks.service';
import { PurgeService } from './purge.service';
import { MAX_TRASH_SCAN, TrashEntityType, retentionCutoff } from './trash-fields';

/** One entry of the trash or of the archive. */
export interface TrashItem {
  entityType: TrashEntityType;
  id: string;
  name: string;
  /** `deletedAt` in the trash, `archivedAt` in the archive. */
  at: string;
  customId?: string;
  spaceId?: string;
  folderId?: string | null;
  parentFolderId?: string | null;
  listId?: string;
  parentTaskId?: string | null;
}

/** What a restore gives back: the document of the entity, as its own endpoint does. */
export type RestoredEntity = SpaceDocument | FolderDocument | ListDocument | TaskDocument;

type StampField = 'deletedAt' | 'archivedAt';

interface Loaded {
  spaces: SpaceDocument[];
  folders: FolderDocument[];
  lists: ListDocument[];
  tasks: TaskDocument[];
}

@Injectable()
export class TrashService {
  constructor(
    @InjectModel(Space.name) private readonly spaces: Model<Space>,
    @InjectModel(Folder.name) private readonly folders: Model<Folder>,
    @InjectModel(List.name) private readonly lists: Model<List>,
    @InjectModel(Task.name) private readonly tasks: Model<Task>,
    private readonly access: HierarchyAccessService,
    private readonly permissions: PermissionService,
    private readonly taskAccess: TaskAccessService,
    private readonly spacesService: SpacesService,
    private readonly foldersService: FoldersService,
    private readonly listsService: ListsService,
    private readonly tasksService: TasksService,
    private readonly purge: PurgeService,
  ) {}

  /** Items deleted inside the retention window, newest first. */
  async trash(
    ctx: PermissionContext,
    query: PaginationQueryDto,
    now = new Date(),
  ): Promise<CursorPage<TrashItem>> {
    return this.page(await this.collect(ctx, 'deletedAt', retentionCutoff(now)), query);
  }

  /** Archived items that are not in the trash. */
  async archived(
    ctx: PermissionContext,
    query: PaginationQueryDto,
  ): Promise<CursorPage<TrashItem>> {
    return this.page(await this.collect(ctx, 'archivedAt', null), query);
  }

  /** Puts the item back where it was, with the same rules as its own endpoint. */
  async restore(
    ctx: PermissionContext,
    entityType: TrashEntityType,
    entityId: Types.ObjectId,
  ): Promise<RestoredEntity> {
    if (entityType === 'space') {
      return this.spacesService.restore(ctx, entityId);
    }

    if (entityType === 'folder') {
      return this.foldersService.restore(ctx, entityId);
    }

    if (entityType === 'list') {
      return this.listsService.restore(ctx, entityId);
    }

    return this.tasksService.restore(ctx, String(entityId));
  }

  /** Permanent delete, with everything the item contains. */
  async remove(
    ctx: PermissionContext,
    entityType: TrashEntityType,
    entityId: Types.ObjectId,
  ): Promise<void> {
    if (entityType === 'space') {
      const space = await this.access.requireSpace(ctx, entityId, 'full', { includeDeleted: true });

      await this.purge.purgeSpaces(ctx.workspaceId, [space._id]);

      return;
    }

    if (entityType === 'folder') {
      const folder = await this.access.requireFolder(ctx, entityId, 'full', {
        includeDeleted: true,
      });

      await this.purge.purgeFolders(ctx.workspaceId, [folder._id]);

      return;
    }

    if (entityType === 'list') {
      const list = await this.access.requireList(ctx, entityId, 'full', { includeDeleted: true });

      await this.purge.purgeLists(ctx.workspaceId, [list._id]);

      return;
    }

    const { task } = await this.taskAccess.requireTask(ctx, String(entityId), 'full', {
      includeDeleted: true,
    });

    await this.purge.purgeTasks(ctx.workspaceId, [task._id]);
  }

  /** Only the top of each deleted branch; the cascade children stay hidden. */
  private async collect(
    ctx: PermissionContext,
    field: StampField,
    since: Date | null,
  ): Promise<TrashItem[]> {
    const stamped = since ? { $gte: since } : { $ne: null };
    const scope =
      field === 'deletedAt'
        ? { workspaceId: ctx.workspaceId, deletedAt: stamped }
        : { workspaceId: ctx.workspaceId, deletedAt: null, archivedAt: stamped };
    const loaded = await this.load(scope);
    const roots = await this.roots(ctx.workspaceId, field, loaded);

    return this.visible(ctx, field, roots);
  }

  private async load(scope: Record<string, unknown>): Promise<Loaded> {
    const [spaces, folders, lists, tasks] = await Promise.all([
      this.spaces.find(scope).limit(MAX_TRASH_SCAN).exec(),
      this.folders.find(scope).limit(MAX_TRASH_SCAN).exec(),
      this.lists.find(scope).limit(MAX_TRASH_SCAN).exec(),
      this.tasks.find(scope).limit(MAX_TRASH_SCAN).exec(),
    ]);

    return { spaces, folders, lists, tasks };
  }

  /** Drops what only got the stamp because an ancestor was deleted or archived. */
  private async roots(
    workspaceId: Types.ObjectId,
    field: StampField,
    loaded: Loaded,
  ): Promise<Loaded> {
    const spaceIds = [
      ...loaded.folders.map((folder) => folder.spaceId),
      ...loaded.lists.map((list) => list.spaceId),
    ];
    const folderIds = [
      ...loaded.folders.map((folder) => folder.parentFolderId),
      ...loaded.lists.map((list) => list.folderId),
    ].filter((id): id is Types.ObjectId => id !== null);
    const listIds = loaded.tasks.map((task) => task.listId);
    const parentTaskIds = loaded.tasks
      .map((task) => task.parentTaskId)
      .filter((id): id is Types.ObjectId => id !== null);

    const [stampedSpaces, stampedFolders, stampedLists, stampedTasks] = await Promise.all([
      this.stamped(this.spaces, workspaceId, field, spaceIds),
      this.stamped(this.folders, workspaceId, field, folderIds),
      this.stamped(this.lists, workspaceId, field, listIds),
      this.stamped(this.tasks, workspaceId, field, parentTaskIds),
    ]);

    return {
      spaces: loaded.spaces,
      folders: loaded.folders.filter(
        (folder) =>
          !stampedSpaces.has(String(folder.spaceId)) &&
          !(folder.parentFolderId && stampedFolders.has(String(folder.parentFolderId))),
      ),
      lists: loaded.lists.filter(
        (list) =>
          !stampedSpaces.has(String(list.spaceId)) &&
          !(list.folderId && stampedFolders.has(String(list.folderId))),
      ),
      tasks: loaded.tasks.filter(
        (task) =>
          !stampedLists.has(String(task.listId)) &&
          !(task.parentTaskId && stampedTasks.has(String(task.parentTaskId))),
      ),
    };
  }

  private async stamped<T>(
    model: Model<T>,
    workspaceId: Types.ObjectId,
    field: StampField,
    ids: Types.ObjectId[],
  ): Promise<Set<string>> {
    if (ids.length === 0) {
      return new Set();
    }

    const docs = await model
      .find({ workspaceId, _id: { $in: ids }, [field]: { $ne: null } })
      .select('_id')
      .exec();

    return new Set(docs.map((doc) => String(doc._id)));
  }

  private async visible(
    ctx: PermissionContext,
    field: StampField,
    loaded: Loaded,
  ): Promise<TrashItem[]> {
    const explicit = await this.permissions.explicitLevels(ctx);
    const canView = (chain: ResourceRef[]): boolean =>
      this.permissions.canView(this.permissions.levelFromChain(ctx, chain, explicit));
    const items: TrashItem[] = [];

    for (const space of loaded.spaces) {
      if (canView(this.access.spaceChain(space))) {
        items.push(spaceItem(space, field));
      }
    }

    for (const folder of loaded.folders) {
      if (canView(await this.access.folderChain(folder))) {
        items.push(folderItem(folder, field));
      }
    }

    for (const list of loaded.lists) {
      if (canView(await this.access.listChain(list))) {
        items.push(listItem(list, field));
      }
    }

    const listsById = await this.listsOf(ctx.workspaceId, loaded.tasks);

    for (const task of loaded.tasks) {
      const list = listsById.get(String(task.listId));

      if (list && canView(await this.taskAccess.taskChain(list, task))) {
        items.push(taskItem(task, field));
      }
    }

    return items.sort((a, b) => (a.at === b.at ? (a.id < b.id ? 1 : -1) : a.at < b.at ? 1 : -1));
  }

  private async listsOf(
    workspaceId: Types.ObjectId,
    tasks: TaskDocument[],
  ): Promise<Map<string, ListDocument>> {
    if (tasks.length === 0) {
      return new Map();
    }

    const docs = await this.lists
      .find({ workspaceId, _id: { $in: tasks.map((task) => task.listId) } })
      .exec();

    return new Map(docs.map((list) => [String(list._id), list]));
  }

  /** Cursor over (date, id), both descending, so the page is stable. */
  private page(items: TrashItem[], query: PaginationQueryDto): CursorPage<TrashItem> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const after = query.cursor ? cursorOf(query.cursor) : null;
    const pending = after
      ? items.filter((item) => item.at < after.at || (item.at === after.at && item.id < after.id))
      : items;

    return buildCursorPage(pending.slice(0, limit + 1), limit, (item) => ({
      at: item.at,
      id: item.id,
    }));
  }
}

function cursorOf(cursor: string): { at: string; id: string } {
  const { at, id } = decodeCursor(cursor);

  if (typeof at !== 'string' || typeof id !== 'string') {
    throw new BadRequestException({ code: 'INVALID_CURSOR', message: 'Cursor inválido.' });
  }

  return { at, id };
}

function stampOf(doc: { deletedAt: Date | null; archivedAt: Date | null }, field: StampField) {
  return (doc[field] ?? new Date()).toISOString();
}

function spaceItem(space: SpaceDocument, field: StampField): TrashItem {
  return {
    entityType: 'space',
    id: String(space._id),
    name: space.name,
    at: stampOf(space, field),
  };
}

function folderItem(folder: FolderDocument, field: StampField): TrashItem {
  return {
    entityType: 'folder',
    id: String(folder._id),
    name: folder.name,
    at: stampOf(folder, field),
    spaceId: String(folder.spaceId),
    parentFolderId: folder.parentFolderId ? String(folder.parentFolderId) : null,
  };
}

function listItem(list: ListDocument, field: StampField): TrashItem {
  return {
    entityType: 'list',
    id: String(list._id),
    name: list.name,
    at: stampOf(list, field),
    spaceId: String(list.spaceId),
    folderId: list.folderId ? String(list.folderId) : null,
  };
}

function taskItem(task: TaskDocument, field: StampField): TrashItem {
  return {
    entityType: 'task',
    id: String(task._id),
    name: task.name,
    at: stampOf(task, field),
    customId: task.customId,
    listId: String(task.listId),
    parentTaskId: task.parentTaskId ? String(task.parentTaskId) : null,
  };
}
