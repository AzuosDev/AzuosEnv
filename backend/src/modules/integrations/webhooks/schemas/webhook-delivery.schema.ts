import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../../common/schemas/base-schema-options';
import { WEBHOOK_DELIVERY_STATUSES, WebhookDeliveryStatus } from '../webhook-fields';

/** Log of one attempt chain: the payload, how many tries and how it ended. */
@Schema({ collection: 'webhook_deliveries', ...baseSchemaOptions })
export class WebhookDelivery {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'OutgoingWebhook', required: true, index: true })
  webhookId: Types.ObjectId;

  @Prop({ required: true })
  event: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  payload: Record<string, unknown>;

  @Prop({ type: String, enum: WEBHOOK_DELIVERY_STATUSES, default: 'pending' })
  status: WebhookDeliveryStatus;

  @Prop({ type: Number, default: 0 })
  attempts: number;

  @Prop({ type: Number, default: null })
  statusCode: number | null;

  @Prop({ type: String, default: null })
  error: string | null;

  /** When the retry becomes due; null once the delivery is settled. */
  @Prop({ type: Date, default: null })
  nextAttemptAt: Date | null;

  @Prop({ type: Date, default: null })
  deliveredAt: Date | null;
}

export type WebhookDeliveryDocument = HydratedDocument<WebhookDelivery>;

export const WebhookDeliverySchema = SchemaFactory.createForClass(WebhookDelivery);

WebhookDeliverySchema.index({ workspaceId: 1, webhookId: 1, _id: -1 });
WebhookDeliverySchema.index({ status: 1, nextAttemptAt: 1 });
WebhookDeliverySchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
