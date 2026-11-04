import { Types } from 'mongoose';
import { TaskChanges } from '../tasks/task-events';

export const PAGE_CREATED = 'page.created';
export const PAGE_UPDATED = 'page.updated';
export const PAGE_COMMENTED = 'page.commented';

export interface PageEventBase {
  workspaceId: Types.ObjectId;
  docId: Types.ObjectId;
  pageId: Types.ObjectId;
  parentPageId: Types.ObjectId | null;
  version: number;
  actorId: Types.ObjectId;
}

export type PageCreatedEvent = PageEventBase;

export interface PageUpdatedEvent extends PageEventBase {
  changes: TaskChanges;
}

export interface PageCommentedEvent extends PageEventBase {
  commentId: Types.ObjectId;
  anchor: string | null;
  mentions: Types.ObjectId[];
}
