import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage } from '../../common/pagination/cursor';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { STATUS_SET_UPDATED, StatusSetUpdatedEvent } from '../hierarchy/hierarchy-events';
import { HierarchyAccessService } from '../hierarchy/hierarchy-access.service';
import {
  appendPosition,
  paginateByPosition,
  positionBetweenSiblings,
  positionedModel,
} from '../hierarchy/ordering';
import { PermissionContext } from '../hierarchy/permission.service';
import { ListDocument } from '../hierarchy/schemas/list.schema';
import { Status } from '../hierarchy/schemas/status-set.schema';
import { StatusSetsService } from '../hierarchy/status-sets.service';
import { MembersService } from '../workspaces/members.service';
import { CountersService } from './counters.service';
import { BulkChangesDto, BulkTasksDto } from './dto/task-query.dto';
import { CreateTaskDto, MoveTaskDto, UpdateTaskDto } from './dto/task.dto';
import { Task, TaskDocument } from './schemas/task.schema';
import { TagsService } from './tags.service';
import { TaskAccessService } from './task-access.service';
import { isClosedGroup, recordChange, toDate } from './task-diff';
import {
  TASK_CREATED,
  TASK_DELETED,
  TASK_MOVED,
  TASK_UPDATED,
  TaskChanges,
  TaskCreatedEvent,
  TaskDeletedEvent,
  TaskMovedEvent,
  TaskUpdatedEvent,
} from './task-events';
import { MAX_SUBTASK_DEPTH } from './task-fields';

export interface BulkResult {
  updated: number;
  skipped: { id: string; code: string }[];
}

interface ResolvedStatus {
  statusId: Types.ObjectId;
  statusGroup: Status['group'];
}

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private readonly model: Model<Task>,
    private readonly access: HierarchyAccessService,
    private readonly taskAccess: TaskAccessService,
    private readonly statusSets: StatusSetsService,
    private readonly members: MembersService,
    private readonly counters: CountersService,
    private readonly tags: TagsService,
    private readonly events: EventEmitter2,
  ) {}

  async create(
    ctx: PermissionContext,
    listId: Types.ObjectId,
    taskPrefix: string,
    dto: CreateTaskDto,
  ): Promise<TaskDocument> {
    const list = await this.access.requireList(ctx, listId, 'edit');
    const parent = dto.parentTaskId ? await this.requireParent(ctx, dto.parentTaskId, list) : null;
    const status = await this.resolveStatus(list, dto.statusId);
    const dueAt = toDate(dto.dueAt);

    const task = await this.model.create({
      workspaceId: ctx.workspaceId,
      listId: list._id,
      listIds: [list._id],
      parentTaskId: parent?._id ?? null,
      customId: await this.counters.nextCustomId(ctx.workspaceId, taskPrefix),
      name: dto.name,
      description: dto.description ?? null,
      descriptionText: dto.descriptionText ?? '',
      statusId: status.statusId,
      statusGroup: status.statusGroup,
      priority: dto.priority ?? null,
      assigneeIds: await this.requireMembers(ctx, dto.assigneeIds, 'INVALID_ASSIGNEES'),
      watcherIds: await this.requireMembers(ctx, dto.watcherIds, 'INVALID_WATCHERS'),
      tagIds: await this.tags.requireOwned(ctx.workspaceId, dto.tagIds),
      startAt: toDate(dto.startAt),
      dueAt,
      dueHasTime: dto.dueHasTime ?? false,
      estimateMinutes: dto.estimateMinutes ?? null,
      points: dto.points ?? null,
      type: dto.type ?? 'task',
      position: await appendPosition(positionedModel(this.model), this.siblings(ctx, list._id)),
      closedAt: isClosedGroup(status.statusGroup) ? new Date() : null,
      createdBy: ctx.userId,
    });

    this.events.emit(TASK_CREATED, this.baseEvent(ctx, task) satisfies TaskCreatedEvent);

    return task;
  }

  async get(ctx: PermissionContext, idOrCustomId: string): Promise<TaskDocument> {
    const { task } = await this.taskAccess.requireTask(ctx, idOrCustomId, 'view');

    return task;
  }

  async update(
    ctx: PermissionContext,
    idOrCustomId: string,
    dto: UpdateTaskDto,
  ): Promise<TaskDocument> {
    const { task, list } = await this.taskAccess.requireTask(ctx, idOrCustomId, 'edit');
    const changes: TaskChanges = {};

    if (dto.name !== undefined) {
      this.apply(task, changes, 'name', dto.name);
    }

    if (dto.description !== undefined) {
      this.apply(task, changes, 'description', dto.description ?? null);
    }

    if (dto.descriptionText !== undefined) {
      this.apply(task, changes, 'descriptionText', dto.descriptionText);
    }

    if (dto.priority !== undefined) {
      this.apply(task, changes, 'priority', dto.priority ?? null);
    }

    if (dto.assigneeIds !== undefined) {
      this.apply(
        task,
        changes,
        'assigneeIds',
        await this.requireMembers(ctx, dto.assigneeIds, 'INVALID_ASSIGNEES'),
      );
    }

    if (dto.watcherIds !== undefined) {
      this.apply(
        task,
        changes,
        'watcherIds',
        await this.requireMembers(ctx, dto.watcherIds, 'INVALID_WATCHERS'),
      );
    }

    if (dto.tagIds !== undefined) {
      this.apply(
        task,
        changes,
        'tagIds',
        await this.tags.requireOwned(ctx.workspaceId, dto.tagIds),
      );
    }

    if (dto.startAt !== undefined) {
      this.apply(task, changes, 'startAt', toDate(dto.startAt));
    }

    if (dto.dueAt !== undefined) {
      this.apply(task, changes, 'dueAt', toDate(dto.dueAt));
    }

    if (dto.dueHasTime !== undefined) {
      this.apply(task, changes, 'dueHasTime', dto.dueHasTime);
    }

    if (dto.estimateMinutes !== undefined) {
      this.apply(task, changes, 'estimateMinutes', dto.estimateMinutes ?? null);
    }

    if (dto.points !== undefined) {
      this.apply(task, changes, 'points', dto.points ?? null);
    }

    if (dto.type !== undefined) {
      this.apply(task, changes, 'type', dto.type);
    }

    if (dto.statusId !== undefined) {
      await this.applyStatus(task, changes, list, dto.statusId);
    }

    return this.saveWithChanges(ctx, task, changes);
  }

  async move(
    ctx: PermissionContext,
    idOrCustomId: string,
    dto: MoveTaskDto,
  ): Promise<TaskDocument> {
    const { task } = await this.taskAccess.requireTask(ctx, idOrCustomId, 'edit');
    const fromListId = task.listId;
    const target = dto.listId
      ? await this.access.requireList(ctx, new Types.ObjectId(dto.listId), 'edit')
      : null;

    if (target) {
      await this.setPrimaryList(ctx, task, target);
    }

    task.position = await positionBetweenSiblings(
      positionedModel(this.model),
      this.siblings(ctx, task.listId),
      dto.previousId ? new Types.ObjectId(dto.previousId) : null,
      dto.nextId ? new Types.ObjectId(dto.nextId) : null,
    );

    await task.save();

    this.events.emit(TASK_MOVED, {
      ...this.baseEvent(ctx, task),
      fromListId,
      toListId: task.listId,
    } satisfies TaskMovedEvent);

    return task;
  }

  /** Adds the task to another List without changing its primary one. */
  async addSecondaryList(
    ctx: PermissionContext,
    idOrCustomId: string,
    listId: string,
  ): Promise<TaskDocument> {
    const { task } = await this.taskAccess.requireTask(ctx, idOrCustomId, 'edit');
    const list = await this.access.requireList(ctx, new Types.ObjectId(listId), 'edit');
    const changes: TaskChanges = {};

    this.apply(task, changes, 'listIds', unique([...task.listIds, list._id]));

    return this.saveWithChanges(ctx, task, changes);
  }

  async removeSecondaryList(
    ctx: PermissionContext,
    idOrCustomId: string,
    listId: string,
  ): Promise<TaskDocument> {
    const { task } = await this.taskAccess.requireTask(ctx, idOrCustomId, 'edit');

    if (String(task.listId) === listId) {
      throw new BadRequestException({
        code: 'PRIMARY_LIST_IMMUTABLE',
        message: 'Use mover para trocar a List principal da tarefa.',
      });
    }

    const changes: TaskChanges = {};

    this.apply(
      task,
      changes,
      'listIds',
      task.listIds.filter((id) => String(id) !== listId),
    );

    return this.saveWithChanges(ctx, task, changes);
  }

  async subtasks(
    ctx: PermissionContext,
    idOrCustomId: string,
    query: PaginationQueryDto,
  ): Promise<CursorPage<TaskDocument>> {
    const { task } = await this.taskAccess.requireTask(ctx, idOrCustomId, 'view');
    const docs = await this.model
      .find({ workspaceId: ctx.workspaceId, parentTaskId: task._id, deletedAt: null })
      .sort({ position: 1 })
      .exec();

    return paginateByPosition(docs, query);
  }

  /** Soft delete; descendant subtasks go to the trash with the same date. */
  async remove(ctx: PermissionContext, idOrCustomId: string): Promise<void> {
    const { task } = await this.taskAccess.requireTask(ctx, idOrCustomId, 'full');

    await this.softDelete(ctx, task);
  }

  async restore(ctx: PermissionContext, idOrCustomId: string): Promise<TaskDocument> {
    const { task } = await this.taskAccess.requireTask(ctx, idOrCustomId, 'full', {
      includeDeleted: true,
    });
    const deletedAt = task.deletedAt;

    task.deletedAt = null;
    await task.save();

    if (deletedAt) {
      await this.model
        .updateMany(
          { workspaceId: ctx.workspaceId, parentTaskId: task._id, deletedAt },
          { $set: { deletedAt: null } },
        )
        .exec();
    }

    return task;
  }

  /** Applies the same changes to up to 200 tasks, skipping the ones it cannot touch. */
  async bulk(ctx: PermissionContext, dto: BulkTasksDto): Promise<BulkResult> {
    const changes = dto.changes;
    const addAssigneeIds = await this.requireMembers(
      ctx,
      changes.addAssigneeIds,
      'INVALID_ASSIGNEES',
    );
    const removeAssigneeIds = (changes.removeAssigneeIds ?? []).map((id) => new Types.ObjectId(id));
    const result: BulkResult = { updated: 0, skipped: [] };

    for (const id of [...new Set(dto.ids)]) {
      try {
        await this.applyBulk(ctx, id, changes, addAssigneeIds, removeAssigneeIds);
        result.updated += 1;
      } catch (error) {
        result.skipped.push({ id, code: errorCode(error) });
      }
    }

    return result;
  }

  /** Keeps `statusGroup` in sync when the status set of the hierarchy changes. */
  @OnEvent(STATUS_SET_UPDATED)
  async onStatusSetUpdated(event: StatusSetUpdatedEvent): Promise<void> {
    const closedAt = new Date();

    for (const status of event.statuses) {
      const scope = { workspaceId: event.workspaceId, statusId: status.statusId };

      await this.model.updateMany(scope, { $set: { statusGroup: status.group } }).exec();

      await (isClosedGroup(status.group)
        ? this.model.updateMany({ ...scope, closedAt: null }, { $set: { closedAt } }).exec()
        : this.model
            .updateMany({ ...scope, closedAt: { $ne: null } }, { $set: { closedAt: null } })
            .exec());
    }
  }

  private async applyBulk(
    ctx: PermissionContext,
    id: string,
    changes: BulkChangesDto,
    addAssigneeIds: Types.ObjectId[],
    removeAssigneeIds: Types.ObjectId[],
  ): Promise<void> {
    if (changes.deleted) {
      const { task } = await this.taskAccess.requireTask(ctx, id, 'full');

      await this.softDelete(ctx, task);

      return;
    }

    const { task, list } = await this.taskAccess.requireTask(ctx, id, 'edit');
    const diff: TaskChanges = {};
    const fromListId = task.listId;

    if (changes.listId && String(task.listId) !== changes.listId) {
      const target = await this.access.requireList(ctx, new Types.ObjectId(changes.listId), 'edit');

      recordChange(diff, 'listId', task.listId, target._id);
      await this.setPrimaryList(ctx, task, target);
    }

    if (changes.statusId !== undefined) {
      await this.applyStatus(task, diff, list, changes.statusId);
    }

    if (changes.priority !== undefined) {
      this.apply(task, diff, 'priority', changes.priority ?? null);
    }

    if (changes.startAt !== undefined) {
      this.apply(task, diff, 'startAt', toDate(changes.startAt));
    }

    if (changes.dueAt !== undefined) {
      this.apply(task, diff, 'dueAt', toDate(changes.dueAt));
    }

    if (changes.dueHasTime !== undefined) {
      this.apply(task, diff, 'dueHasTime', changes.dueHasTime);
    }

    if (addAssigneeIds.length > 0 || removeAssigneeIds.length > 0) {
      const removed = new Set(removeAssigneeIds.map(String));

      this.apply(
        task,
        diff,
        'assigneeIds',
        unique([...task.assigneeIds, ...addAssigneeIds]).filter((id) => !removed.has(String(id))),
      );
    }

    await this.saveWithChanges(ctx, task, diff);

    if (String(fromListId) !== String(task.listId)) {
      this.events.emit(TASK_MOVED, {
        ...this.baseEvent(ctx, task),
        fromListId,
        toListId: task.listId,
      } satisfies TaskMovedEvent);
    }
  }

  private async softDelete(ctx: PermissionContext, task: TaskDocument): Promise<void> {
    const deletedAt = new Date();

    task.deletedAt = deletedAt;
    await task.save();

    await this.model
      .updateMany(
        { workspaceId: ctx.workspaceId, parentTaskId: task._id, deletedAt: null },
        { $set: { deletedAt } },
      )
      .exec();

    this.events.emit(TASK_DELETED, this.baseEvent(ctx, task) satisfies TaskDeletedEvent);
  }

  /** Moves the primary list, keeping the secondary ones. */
  private async setPrimaryList(
    ctx: PermissionContext,
    task: TaskDocument,
    target: ListDocument,
  ): Promise<void> {
    const secondary = task.listIds.filter((id) => String(id) !== String(task.listId));

    task.listId = target._id;
    task.listIds = unique([target._id, ...secondary]);
    task.position = await appendPosition(
      positionedModel(this.model),
      this.siblings(ctx, target._id),
    );

    const status = await this.resolveStatus(target, String(task.statusId), { fallback: true });

    task.statusId = status.statusId;
    task.statusGroup = status.statusGroup;
    task.closedAt = isClosedGroup(status.statusGroup) ? (task.closedAt ?? new Date()) : null;
  }

  private async applyStatus(
    task: TaskDocument,
    changes: TaskChanges,
    list: ListDocument,
    statusId: string,
  ): Promise<void> {
    const status = await this.resolveStatus(list, statusId);

    if (!this.apply(task, changes, 'statusId', status.statusId)) {
      return;
    }

    this.apply(task, changes, 'statusGroup', status.statusGroup);

    if (isClosedGroup(status.statusGroup)) {
      task.closedAt ??= new Date();
    } else {
      task.closedAt = null;
    }
  }

  /**
   * Status of the List status set. Without `statusId` it is the first one; with
   * `fallback` a status missing from the set (after a move) also falls back to it.
   */
  private async resolveStatus(
    list: ListDocument,
    statusId?: string,
    options: { fallback?: boolean } = {},
  ): Promise<ResolvedStatus> {
    const effective = await this.statusSets.resolveForList(list);
    const first = effective.statuses[0];
    const found = statusId
      ? effective.statuses.find((status) => String(status._id) === statusId)
      : first;
    const status = found ?? (options.fallback ? first : undefined);

    if (!status) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: 'Status inválido para esta List.',
      });
    }

    return { statusId: status._id, statusGroup: status.group };
  }

  private async requireParent(
    ctx: PermissionContext,
    parentTaskId: string,
    list: ListDocument,
  ): Promise<TaskDocument> {
    const { task: parent } = await this.taskAccess.requireTask(ctx, parentTaskId, 'edit');

    if (String(parent.listId) !== String(list._id)) {
      throw new BadRequestException({
        code: 'INVALID_TASK_PARENT',
        message: 'A subtarefa deve ser criada na List da tarefa pai.',
      });
    }

    if ((await this.depthOf(ctx, parent)) >= MAX_SUBTASK_DEPTH) {
      throw new BadRequestException({
        code: 'TASK_DEPTH_EXCEEDED',
        message: `A profundidade máxima de subtarefas é ${MAX_SUBTASK_DEPTH}.`,
      });
    }

    return parent;
  }

  /** 1 for a root task, 2 for its subtask, and so on. */
  private async depthOf(ctx: PermissionContext, task: TaskDocument): Promise<number> {
    let depth = 1;
    let parentId = task.parentTaskId;

    while (parentId && depth <= MAX_SUBTASK_DEPTH) {
      const parent = await this.model
        .findOne({ _id: parentId, workspaceId: ctx.workspaceId })
        .select('parentTaskId')
        .exec();

      if (!parent) {
        break;
      }

      depth += 1;
      parentId = parent.parentTaskId;
    }

    return depth;
  }

  private async requireMembers(
    ctx: PermissionContext,
    userIds: string[] | undefined,
    code: 'INVALID_ASSIGNEES' | 'INVALID_WATCHERS',
  ): Promise<Types.ObjectId[]> {
    if (!userIds?.length) {
      return [];
    }

    const ids = [...new Set(userIds)].map((id) => new Types.ObjectId(id));
    const active = await this.members.activeUserIds(ctx.workspaceId, ids);

    if (active.length !== ids.length) {
      throw new BadRequestException({
        code,
        message: 'Um ou mais usuários não são membros ativos deste workspace.',
      });
    }

    return ids;
  }

  private apply<K extends keyof TaskDocument & string>(
    task: TaskDocument,
    changes: TaskChanges,
    field: K,
    value: TaskDocument[K],
  ): boolean {
    if (!recordChange(changes, field, task[field], value)) {
      return false;
    }

    task[field] = value;

    return true;
  }

  private async saveWithChanges(
    ctx: PermissionContext,
    task: TaskDocument,
    changes: TaskChanges,
  ): Promise<TaskDocument> {
    if (Object.keys(changes).length === 0) {
      return task;
    }

    await task.save();

    this.events.emit(TASK_UPDATED, {
      ...this.baseEvent(ctx, task),
      changes,
    } satisfies TaskUpdatedEvent);

    return task;
  }

  private baseEvent(ctx: PermissionContext, task: TaskDocument) {
    return {
      workspaceId: ctx.workspaceId,
      taskId: task._id,
      customId: task.customId,
      listId: task.listId,
      actorId: ctx.userId,
    };
  }

  private siblings(ctx: PermissionContext, listId: Types.ObjectId): Record<string, unknown> {
    return { workspaceId: ctx.workspaceId, listIds: listId, deletedAt: null };
  }
}

function unique(ids: Types.ObjectId[]): Types.ObjectId[] {
  const seen = new Set<string>();

  return ids.filter((id) => {
    const key = String(id);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}

function errorCode(error: unknown): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();

    if (typeof response === 'object' && response !== null && 'code' in response) {
      return String((response as { code: unknown }).code);
    }
  }

  return 'UNKNOWN_ERROR';
}
