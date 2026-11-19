import { Types } from 'mongoose';
import {
  WaConversationStatus,
  WaDirection,
  WaMessageStatus,
  WaMessageType,
} from './whatsapp-fields';

export const WA_MESSAGE_CREATED = 'whatsapp.message.created';
export const WA_MESSAGE_STATUS = 'whatsapp.message.status';
export const WA_CONVERSATION_UPDATED = 'whatsapp.conversation.updated';

export interface WaMessageCreatedEvent {
  workspaceId: Types.ObjectId;
  conversationId: Types.ObjectId;
  messageId: Types.ObjectId;
  direction: WaDirection;
  type: WaMessageType;
  preview: string;
  authorId: Types.ObjectId | null;
}

export interface WaMessageStatusEvent {
  workspaceId: Types.ObjectId;
  conversationId: Types.ObjectId;
  messageId: Types.ObjectId;
  status: WaMessageStatus;
  error: string | null;
}

export interface WaConversationUpdatedEvent {
  workspaceId: Types.ObjectId;
  conversationId: Types.ObjectId;
  status: WaConversationStatus;
  assigneeId: Types.ObjectId | null;
  unreadCount: number;
}
