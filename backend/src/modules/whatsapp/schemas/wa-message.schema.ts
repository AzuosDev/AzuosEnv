import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiHideProperty } from '@nestjs/swagger';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import {
  WA_DIRECTIONS,
  WA_MESSAGE_STATUSES,
  WA_MESSAGE_TYPES,
  WaDirection,
  WaMessageStatus,
  WaMessageType,
} from '../whatsapp-fields';

/** File of the message, already downloaded from the Graph API into the storage. */
@Schema({ _id: false })
export class WaMessageMedia {
  /** Key of the StorageService; never exposed by the API. */
  @ApiHideProperty()
  @Prop({ type: String, default: null, select: false })
  storageKey: string | null;

  @Prop({ type: String, default: '' })
  mime: string;

  @Prop({ type: String, default: '' })
  caption: string;

  @Prop({ type: String, default: '' })
  filename: string;

  @Prop({ type: Number, default: 0 })
  size: number;

  /** Id of the media inside Meta, kept so the file can be fetched again. */
  @Prop({ type: String, default: '' })
  mediaId: string;
}

export const WaMessageMediaSchema = SchemaFactory.createForClass(WaMessageMedia);

/** Error of a message Meta refused to deliver. */
@Schema({ _id: false })
export class WaMessageError {
  @Prop({ type: String, default: '' })
  code: string;

  @Prop({ type: String, default: '' })
  title: string;

  @Prop({ type: String, default: '' })
  message: string;
}

export const WaMessageErrorSchema = SchemaFactory.createForClass(WaMessageError);

@Schema({ collection: 'wa_messages', ...baseSchemaOptions })
export class WaMessage {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'WaConversation', required: true, index: true })
  conversationId: Types.ObjectId;

  /** Id of Meta. Unique: it is what makes the webhook idempotent. */
  @Prop({ type: String, default: null })
  waMessageId: string | null;

  @Prop({ type: String, enum: WA_DIRECTIONS, required: true })
  direction: WaDirection;

  @Prop({ type: String, enum: WA_MESSAGE_TYPES, required: true })
  type: WaMessageType;

  /** Text of the message, the caption of the media or the emoji of the reaction. */
  @Prop({ type: String, default: '' })
  body: string;

  @Prop({ type: WaMessageMediaSchema, default: null })
  media: WaMessageMedia | null;

  /** Everything the type carries beyond the text (location, contacts, button). */
  @Prop({ type: Object, default: null })
  payload: Record<string, unknown> | null;

  /** waMessageId of the quoted message. */
  @Prop({ type: String, default: null })
  replyTo: string | null;

  @Prop({ type: String, enum: WA_MESSAGE_STATUSES, default: 'pending' })
  status: WaMessageStatus;

  @Prop({ type: WaMessageErrorSchema, default: null })
  error: WaMessageError | null;

  /** Member who sent it; null on an inbound message or on a bot answer. */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  authorId: Types.ObjectId | null;

  @Prop({ type: Boolean, default: false })
  fromBot: boolean;

  @Prop({ type: Date, required: true })
  sentAt: Date;
}

export type WaMessageDocument = HydratedDocument<WaMessage>;

export const WaMessageSchema = SchemaFactory.createForClass(WaMessage);

WaMessageSchema.index({ waMessageId: 1 }, { unique: true, sparse: true });
WaMessageSchema.index({ workspaceId: 1, conversationId: 1, _id: -1 });
