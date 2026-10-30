import { Types } from 'mongoose';
import { TaskChanges } from '../tasks/task-events';
import { CommentEntityType } from './collaboration-fields';

export const COMMENT_CREATED = 'comment.created';
export const COMMENT_UPDATED = 'comment.updated';

export interface CommentEventBase {
  workspaceId: Types.ObjectId;
  commentId: Types.ObjectId;
  entityType: CommentEntityType;
  entityId: Types.ObjectId;
  parentCommentId: Types.ObjectId | null;
  taskId: Types.ObjectId | null;
  listId: Types.ObjectId | null;
  mentions: Types.ObjectId[];
  assigneeId: Types.ObjectId | null;
  actorId: Types.ObjectId;
}

export type CommentCreatedEvent = CommentEventBase;

export interface CommentUpdatedEvent extends CommentEventBase {
  changes: TaskChanges;
}
