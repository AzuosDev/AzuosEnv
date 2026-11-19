import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';

/** Person on the other side of the number, with the notes of the team. */
@Schema({ collection: 'wa_contacts', ...baseSchemaOptions })
export class WaContact {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  /** Number in the wa_id format of Meta (digits only, with country code). */
  @Prop({ required: true, trim: true })
  waId: string;

  /** Name the team gave the contact; falls back to the profile name. */
  @Prop({ type: String, default: '' })
  name: string;

  /** Name of the WhatsApp profile, as it arrives in the webhook. */
  @Prop({ type: String, default: '' })
  profileName: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  /** Internal notes; the contact never sees them. */
  @Prop({ type: String, default: '' })
  notes: string;

  @Prop({ type: Date, default: null })
  firstContactAt: Date | null;

  @Prop({ type: Date, default: null })
  lastInteractionAt: Date | null;

  /** The contact asked to stop receiving messages. */
  @Prop({ type: Boolean, default: false })
  optOut: boolean;

  /** Optional link with the Space of the client in the Azuos Env. */
  @Prop({ type: Types.ObjectId, ref: 'Space', default: null })
  spaceId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Folder', default: null })
  folderId: Types.ObjectId | null;
}

export type WaContactDocument = HydratedDocument<WaContact>;

export const WaContactSchema = SchemaFactory.createForClass(WaContact);

WaContactSchema.index({ workspaceId: 1, waId: 1 }, { unique: true });
WaContactSchema.index({ workspaceId: 1, lastInteractionAt: -1 });
