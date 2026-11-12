import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiHideProperty } from '@nestjs/swagger';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../../common/schemas/base-schema-options';
import { OUTGOING_WEBHOOK_EVENTS, OutgoingWebhookEvent } from '../webhook-fields';

/**
 * Destination the workspace wants to be notified at. The secret signs the body and
 * is stored encrypted, because the server has to read it back on every delivery.
 */
@Schema({ collection: 'outgoing_webhooks', ...baseSchemaOptions })
export class OutgoingWebhook {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  url: string;

  @Prop({ type: [String], enum: OUTGOING_WEBHOOK_EVENTS, default: [] })
  events: OutgoingWebhookEvent[];

  /** Encrypted by the SecretsService; the plain value is shown once, on creation. */
  @ApiHideProperty()
  @Prop({ required: true, select: false })
  secret: string;

  @Prop({ type: Boolean, default: true })
  active: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Date, default: null })
  lastDeliveryAt: Date | null;
}

export type OutgoingWebhookDocument = HydratedDocument<OutgoingWebhook>;

export const OutgoingWebhookSchema = SchemaFactory.createForClass(OutgoingWebhook);

OutgoingWebhookSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    const plain = ret as unknown as Record<string, unknown>;
    plain.id = String(plain._id);
    delete plain._id;
    delete plain.__v;
    delete plain.secret;

    return plain;
  },
});

OutgoingWebhookSchema.index({ workspaceId: 1, active: 1, _id: -1 });
