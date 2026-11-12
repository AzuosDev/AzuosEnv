import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HierarchyAccessService } from '../hierarchy/hierarchy-access.service';
import { PermissionLevel } from '../hierarchy/permission-levels';
import { PermissionContext, PermissionService, ResourceRef } from '../hierarchy/permission.service';
import { ListDocument } from '../hierarchy/schemas/list.schema';
import { TaskLocation } from './dto/task-query.dto';
import { Task, TaskDocument } from './schemas/task.schema';

export interface TaskWithList {
  task: TaskDocument;
  list: ListDocument;
}

export interface TaskLoadOptions {
  includeDeleted?: boolean;
}

/** Resolves a task by id or customId and enforces the permission of its List. */
@Injectable()
export class TaskAccessService {
  constructor(
    @InjectModel(Task.name) private readonly tasks: Model<Task>,
    private readonly access: HierarchyAccessService,
    private readonly permissions: PermissionService,
  ) {}

  taskNotFound(): NotFoundException {
    return new NotFoundException({ code: 'TASK_NOT_FOUND', message: 'Tarefa não encontrada.' });
  }

  async requireTask(
    ctx: PermissionContext,
    idOrCustomId: string,
    required: PermissionLevel,
    options: TaskLoadOptions = {},
  ): Promise<TaskWithList> {
    const task = await this.findTask(ctx.workspaceId, idOrCustomId, options);

    if (!task) {
      throw this.taskNotFound();
    }

    return { task, list: await this.requireAccess(ctx, task, required) };
  }

  /** Same enforcement for a task already loaded. */
  async requireAccess(
    ctx: PermissionContext,
    task: TaskDocument,
    required: PermissionLevel,
  ): Promise<ListDocument> {
    const list = await this.loadList(ctx, task);
    const level = await this.permissions.levelFor(ctx, await this.taskChain(list, task));

    this.permissions.assertLevel(level, required, () => this.taskNotFound());

    return list;
  }

  async taskChain(list: ListDocument, task: TaskDocument): Promise<ResourceRef[]> {
    const chain = await this.access.listChain(list);

    chain.push({ resourceType: 'task', resourceId: task._id });

    return chain;
  }

  findTask(
    workspaceId: Types.ObjectId,
    idOrCustomId: string,
    options: TaskLoadOptions = {},
  ): Promise<TaskDocument | null> {
    const match = Types.ObjectId.isValid(idOrCustomId)
      ? { $or: [{ _id: new Types.ObjectId(idOrCustomId) }, { customId: idOrCustomId }] }
      : { customId: idOrCustomId.toUpperCase() };

    return this.tasks
      .findOne(
        options.includeDeleted
          ? { workspaceId, ...match }
          : { workspaceId, deletedAt: null, ...match },
      )
      .exec();
  }

  /** Lists the requester can see inside the location, used by the query endpoints. */
  async visibleListIds(
    ctx: PermissionContext,
    location: TaskLocation = 'everything',
    locationId?: string,
  ): Promise<Types.ObjectId[]> {
    if (location === 'list') {
      const listId = this.requireLocationId(locationId, () => this.access.listNotFound());

      return [(await this.access.requireList(ctx, listId, 'view'))._id];
    }

    if (location === 'space') {
      const spaceId = this.requireLocationId(locationId, () => this.access.spaceNotFound());
      const lists = await this.access.visibleLists(ctx, { spaceId });

      return lists.map((list) => list._id);
    }

    if (location === 'folder') {
      const folderId = this.requireLocationId(locationId, () => this.access.folderNotFound());
      const folderIds = await this.access.folderAndDescendantIds(ctx.workspaceId, folderId);
      const lists = await this.access.visibleLists(ctx, { folderId: { $in: folderIds } });

      return lists.map((list) => list._id);
    }

    return (await this.access.visibleLists(ctx)).map((list) => list._id);
  }

  /**
   * Of the given ids, the ones the requester can really see. Used by the bulk
   * reads that start from a list of tasks already on screen.
   */
  async visibleTaskIds(ctx: PermissionContext, ids: Types.ObjectId[]): Promise<Types.ObjectId[]> {
    if (ids.length === 0) {
      return [];
    }

    const listIds = await this.visibleListIds(ctx);

    if (listIds.length === 0) {
      return [];
    }

    const tasks = await this.tasks
      .find({
        _id: { $in: ids },
        workspaceId: ctx.workspaceId,
        listIds: { $in: listIds },
        deletedAt: null,
      })
      .select('_id')
      .exec();

    return tasks.map((task) => task._id);
  }

  /** The List of the task; an invisible List makes the task invisible too. */
  private async loadList(ctx: PermissionContext, task: TaskDocument): Promise<ListDocument> {
    try {
      return await this.access.requireList(ctx, task.listId, 'view', { includeDeleted: true });
    } catch {
      throw this.taskNotFound();
    }
  }

  private requireLocationId(locationId: string | undefined, notFound: () => Error): Types.ObjectId {
    if (!locationId) {
      throw notFound();
    }

    return new Types.ObjectId(locationId);
  }
}
