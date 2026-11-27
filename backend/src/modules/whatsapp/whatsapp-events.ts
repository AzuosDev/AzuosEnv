import { Types } from 'mongoose';
import {
  WaConnectionStatus,
  WaConversationStatus,
  WaDirection,
  WaMessageStatus,
  WaMessageType,
  WaProvider,
} from './whatsapp-fields';

export const WA_MESSAGE_CREATED = 'whatsapp.message.created';
export const WA_MESSAGE_STATUS = 'whatsapp.message.status';
export const WA_CONVERSATION_UPDATED = 'whatsapp.conversation.updated';
export const WA_CONNECTION_STATE = 'whatsapp.connection.state';

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

/** Where the connection of the workspace stands, for the Central to follow. */
export interface WaConnectionStateEvent {
  workspaceId: Types.ObjectId;
  provider: WaProvider;
  status: WaConnectionStatus;
  displayPhone: string;
  verifiedName: string;
  /** True while there is a QR Code waiting to be read. */
  hasQrCode: boolean;
}
