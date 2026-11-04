import { Types } from 'mongoose';
import { WhiteboardOpKind } from './whiteboard-fields';

export const WHITEBOARD_CREATED = 'whiteboard.created';
export const WHITEBOARD_UPDATED = 'whiteboard.updated';
export const WHITEBOARD_DELETED = 'whiteboard.deleted';

export interface WhiteboardEventBase {
  workspaceId: Types.ObjectId;
  whiteboardId: Types.ObjectId;
  version: number;
  actorId: Types.ObjectId;
}

export type WhiteboardCreatedEvent = WhiteboardEventBase;
export type WhiteboardDeletedEvent = WhiteboardEventBase;

export interface WhiteboardUpdatedEvent extends WhiteboardEventBase {
  /** Elements touched by the batch, so a client can patch its own canvas. */
  ops: { op: WhiteboardOpKind; id: string }[];
}
