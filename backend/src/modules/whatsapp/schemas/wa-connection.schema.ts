import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiHideProperty } from '@nestjs/swagger';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import {
  DEFAULT_WA_PROVIDER,
  WA_CONNECTION_STATUSES,
  WA_PROVIDERS,
  WaConnectionStatus,
  WaProvider,
} from '../whatsapp-fields';

/** Number a workspace talks through. One per workspace, on one provider. */
@Schema({ collection: 'wa_connections', ...baseSchemaOptions })
export class WaConnection {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, unique: true })
  workspaceId: Types.ObjectId;

  /** Where the number is plugged in; `evolution` is the default. */
  @Prop({ type: String, enum: WA_PROVIDERS, default: DEFAULT_WA_PROVIDER })
  provider: WaProvider;

  /** Cloud API: id of the number inside the WABA; routes the webhook here. */
  @Prop({ type: String, default: null })
  phoneNumberId: string | null;

  @Prop({ type: String, default: '' })
  wabaId: string;

  /** Evolution: origin of the server, e.g. https://evolution.azuos.dev. */
  @Prop({ type: String, default: '', trim: true })
  baseUrl: string;

  /** Evolution: name of the instance the number is paired on. */
  @Prop({ type: String, default: null, trim: true })
  instanceName: string | null;

  @Prop({ type: String, default: '' })
  displayPhone: string;

  @Prop({ type: String, default: '' })
  verifiedName: string;

  /** Cloud API: permanent token of the Graph API, encrypted at rest. */
  @ApiHideProperty()
  @Prop({ type: String, default: '', select: false })
  accessToken: string;

  /** Cloud API: App Secret that signs the webhook, encrypted at rest. */
  @ApiHideProperty()
  @Prop({ type: String, default: '', select: false })
  appSecret: string;

  /** Evolution: value of the `apikey` header, encrypted at rest. */
  @ApiHideProperty()
  @Prop({ type: String, default: '', select: false })
  apiKey: string;

  /** Cloud API: echoed back on the GET handshake of the webhook. */
  @Prop({ type: String, default: '', trim: true })
  verifyToken: string;

  /**
   * Evolution: secret that goes in the public URL of the webhook, encrypted at
   * rest so the URL can be shown again.
   */
  @ApiHideProperty()
  @Prop({ type: String, default: '', select: false })
  webhookSecret: string;

  /** SHA-256 of the secret above; what an incoming delivery is compared with. */
  @ApiHideProperty()
  @Prop({ type: String, default: '', select: false })
  webhookSecretHash: string;

  /** QR Code in base64 while the instance waits to be read. */
  @ApiHideProperty()
  @Prop({ type: String, default: '', select: false })
  qrCode: string;

  @Prop({ type: Date, default: null })
  qrCodeAt: Date | null;

  @Prop({ type: String, enum: WA_CONNECTION_STATUSES, default: 'pending' })
  status: WaConnectionStatus;

  @Prop({ type: String, default: '' })
  qualityRating: string;

  @Prop({ type: String, default: '' })
  lastError: string;

  @Prop({ type: Date, default: null })
  lastEventAt: Date | null;

  /** When the monitor last saw the number fall; clears on the next connect. */
  @Prop({ type: Date, default: null })
  disconnectedAt: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;
}

export type WaConnectionDocument = HydratedDocument<WaConnection>;

export const WaConnectionSchema = SchemaFactory.createForClass(WaConnection);

// Sparse: only a Cloud API connection has a number id, and only an Evolution
// one has an instance, but neither may be shared with another workspace.
WaConnectionSchema.index({ phoneNumberId: 1 }, { unique: true, sparse: true });
WaConnectionSchema.index({ instanceName: 1 }, { unique: true, sparse: true });
