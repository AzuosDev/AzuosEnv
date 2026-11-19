import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import {
  WA_CONVERSATION_MODES,
  WA_CONVERSATION_STATUSES,
  WA_PRIORITIES,
  WaConversationMode,
  WaConversationStatus,
  WaPriority,
} from '../whatsapp-fields';

/** Thread with one contact. At most one conversation per contact is not closed. */
@Schema({ collection: 'wa_conversations', ...baseSchemaOptions })
export class WaConversation {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'WaContact', required: true, index: true })
  contactId: Types.ObjectId;

  @Prop({ type: String, enum: WA_CONVERSATION_STATUSES, default: 'open' })
  status: WaConversationStatus;

  /** Attendant responsible; null means the conversation is in the queue. */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  assigneeId: Types.ObjectId | null;

  @Prop({ type: String, enum: WA_PRIORITIES, default: 'normal' })
  priority: WaPriority;

  @Prop({ type: String, enum: WA_CONVERSATION_MODES, default: 'bot' })
  mode: WaConversationMode;

  /** While in the future the bot stays quiet even in `bot` mode. */
  @Prop({ type: Date, default: null })
  botPausedUntil: Date | null;

  @Prop({ type: Number, default: 0 })
  unreadCount: number;

  @Prop({ type: Date, default: null })
  lastMessageAt: Date | null;

  /** Opens the 24 h window of free text. */
  @Prop({ type: Date, default: null })
  lastInboundAt: Date | null;

  @Prop({ type: Date, default: null })
  closedAt: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  closedBy: Types.ObjectId | null;
}

export type WaConversationDocument = HydratedDocument<WaConversation>;

export const WaConversationSchema = SchemaFactory.createForClass(WaConversation);

WaConversationSchema.index({ workspaceId: 1, status: 1, lastMessageAt: -1 });
WaConversationSchema.index({ workspaceId: 1, lastMessageAt: -1 });
