import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';

/** One entry per emoji, with everyone who reacted with it. */
@Schema({ _id: false })
export class MessageReaction {
  @Prop({ required: true, trim: true })
  emoji: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  userIds: Types.ObjectId[];
}

export const MessageReactionSchema = SchemaFactory.createForClass(MessageReaction);

/** Rich text of the message, as produced by the editor. */
export type MessageBody = Record<string, unknown> | null;

@Schema({ collection: 'messages', ...baseSchemaOptions })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Channel', required: true, index: true })
  channelId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  authorId: Types.ObjectId;

  @Prop({ type: Object, default: null })
  body: MessageBody;

  @Prop({ type: String, default: '' })
  bodyText: string;

  /** Root message of the thread; null on the root itself. */
  @Prop({ type: Types.ObjectId, ref: 'Message', default: null, index: true })
  parentMessageId: Types.ObjectId | null;

  /** Replies of this root, kept denormalized so the list needs one query. */
  @Prop({ type: Number, default: 0 })
  replyCount: number;

  @Prop({ type: Date, default: null })
  lastReplyAt: Date | null;

  /** Users mentioned in `body`, extracted on every write. */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  mentions: Types.ObjectId[];

  @Prop({ type: [MessageReactionSchema], default: [] })
  reactions: MessageReaction[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Attachment' }], default: [] })
  attachmentIds: Types.ObjectId[];

  @Prop({ type: Date, default: null })
  editedAt: Date | null;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export type MessageDocument = HydratedDocument<Message>;

export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.index({ workspaceId: 1, channelId: 1, parentMessageId: 1, _id: -1 });
MessageSchema.index({ workspaceId: 1, channelId: 1, createdAt: -1 });

// A collection accepts a single text index; this one serves the global search.
MessageSchema.index({ bodyText: 'text' }, { name: 'message_text', default_language: 'portuguese' });
