import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { AiRole } from '../ai-provider';

/** One turn of the conversation, as it was sent to or received from the model. */
@Schema({ _id: false })
export class AiConversationMessage {
  @Prop({ type: String, enum: ['system', 'user', 'assistant', 'tool'], required: true })
  role: AiRole;

  @Prop({ type: String, default: '' })
  content: string;

  /** Tools the assistant asked for, kept so the next turn replays the same context. */
  @Prop({ type: [{ _id: false, id: String, name: String, arguments: String }], default: [] })
  toolCalls: { id: string; name: string; arguments: string }[];

  @Prop({ type: String, default: null })
  toolCallId: string | null;

  @Prop({ type: Date, default: () => new Date() })
  at: Date;
}

export const AiConversationMessageSchema = SchemaFactory.createForClass(AiConversationMessage);

@Schema({ collection: 'ai_conversations', ...baseSchemaOptions })
export class AiConversation {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  /** A conversation is personal: only the author reads and continues it. */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, default: '', trim: true })
  title: string;

  @Prop({ type: [AiConversationMessageSchema], default: [] })
  messages: AiConversationMessage[];

  @Prop({ type: Date, default: null })
  lastMessageAt: Date | null;
}

export type AiConversationDocument = HydratedDocument<AiConversation>;

export const AiConversationSchema = SchemaFactory.createForClass(AiConversation);

AiConversationSchema.index({ workspaceId: 1, userId: 1, _id: -1 });
