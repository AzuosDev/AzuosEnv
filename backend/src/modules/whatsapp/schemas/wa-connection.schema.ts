import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiHideProperty } from '@nestjs/swagger';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { WA_CONNECTION_STATUSES, WaConnectionStatus } from '../whatsapp-fields';

/** Number of the Cloud API a workspace talks through. One per workspace. */
@Schema({ collection: 'wa_connections', ...baseSchemaOptions })
export class WaConnection {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, unique: true })
  workspaceId: Types.ObjectId;

  /** Id of the phone number inside the WABA; routes the webhook to this workspace. */
  @Prop({ required: true, trim: true })
  phoneNumberId: string;

  @Prop({ required: true, trim: true })
  wabaId: string;

  @Prop({ type: String, default: '' })
  displayPhone: string;

  @Prop({ type: String, default: '' })
  verifiedName: string;

  /** Permanent token of the Graph API, encrypted at rest. */
  @ApiHideProperty()
  @Prop({ required: true, select: false })
  accessToken: string;

  /** App Secret that signs the webhook, encrypted at rest. */
  @ApiHideProperty()
  @Prop({ required: true, select: false })
  appSecret: string;

  /** Echoed back on the GET handshake of the webhook. */
  @Prop({ required: true, trim: true })
  verifyToken: string;

  @Prop({ type: String, enum: WA_CONNECTION_STATUSES, default: 'pending' })
  status: WaConnectionStatus;

  @Prop({ type: String, default: '' })
  qualityRating: string;

  @Prop({ type: String, default: '' })
  lastError: string;

  @Prop({ type: Date, default: null })
  lastEventAt: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;
}

export type WaConnectionDocument = HydratedDocument<WaConnection>;

export const WaConnectionSchema = SchemaFactory.createForClass(WaConnection);

WaConnectionSchema.index({ phoneNumberId: 1 }, { unique: true });
