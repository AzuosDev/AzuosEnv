import { Types } from 'mongoose';
import { TaskChanges } from '../tasks/task-events';
import { ChannelType } from './chat-fields';

export const MESSAGE_CREATED = 'message.created';
export const MESSAGE_UPDATED = 'message.updated';
export const MESSAGE_DELETED = 'message.deleted';

/** Everything the realtime gateway and the inbox need without loading the channel. */
export interface MessageEventBase {
  workspaceId: Types.ObjectId;
  channelId: Types.ObjectId;
  channelType: ChannelType;
  channelName: string;
  messageId: Types.ObjectId;
  parentMessageId: Types.ObjectId | null;
  authorId: Types.ObjectId;
  mentions: Types.ObjectId[];
  memberIds: Types.ObjectId[];
  /** Short preview of the text, used by the inbox and the realtime payload. */
  preview: string;
}

export type MessageCreatedEvent = MessageEventBase;

export interface MessageUpdatedEvent extends MessageEventBase {
  changes: TaskChanges;
}

export type MessageDeletedEvent = MessageEventBase;
