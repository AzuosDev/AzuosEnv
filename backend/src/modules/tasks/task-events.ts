import { Types } from 'mongoose';

export const TASK_CREATED = 'task.created';
export const TASK_UPDATED = 'task.updated';
export const TASK_MOVED = 'task.moved';
export const TASK_DELETED = 'task.deleted';

export interface TaskEventBase {
  workspaceId: Types.ObjectId;
  taskId: Types.ObjectId;
  customId: string;
  listId: Types.ObjectId;
  actorId: Types.ObjectId;
}

export type TaskCreatedEvent = TaskEventBase;

/** One entry per field that actually changed. */
export type TaskChanges = Record<string, { from: unknown; to: unknown }>;

export interface TaskUpdatedEvent extends TaskEventBase {
  changes: TaskChanges;
}

export interface TaskMovedEvent extends TaskEventBase {
  fromListId: Types.ObjectId;
  toListId: Types.ObjectId;
}

export type TaskDeletedEvent = TaskEventBase;
