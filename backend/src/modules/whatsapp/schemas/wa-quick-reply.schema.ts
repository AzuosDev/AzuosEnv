import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';

/** Canned answer the attendant picks by typing `/` plus the shortcut. */
@Schema({ collection: 'wa_quick_replies', ...baseSchemaOptions })
export class WaQuickReply {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  /** Lowercase, unique in the workspace; what comes after the `/`. */
  @Prop({ required: true, trim: true, lowercase: true })
  shortcut: string;

  @Prop({ required: true, trim: true })
  title: string;

  /** Accepts the variables of `renderWaText`, such as `{nome}`. */
  @Prop({ type: String, default: '' })
  text: string;

  /** Public link of a file sent along with the text. */
  @Prop({ type: String, default: '' })
  mediaUrl: string;

  @Prop({ type: String, default: '' })
  mediaMime: string;

  @Prop({ type: String, default: '' })
  filename: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;
}

export type WaQuickReplyDocument = HydratedDocument<WaQuickReply>;

export const WaQuickReplySchema = SchemaFactory.createForClass(WaQuickReply);

WaQuickReplySchema.index({ workspaceId: 1, shortcut: 1 }, { unique: true });
