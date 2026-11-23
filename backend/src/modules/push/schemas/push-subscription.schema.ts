import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';

/**
 * One push endpoint of one browser of one user. Like notification_settings, the
 * row belongs to the person and not to a workspace: the same device receives
 * every workspace the user takes part in.
 */
@Schema({ collection: 'push_subscriptions', ...baseSchemaOptions })
export class PushSubscription {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  /** URL of the browser push service; it is the identity of the subscription. */
  @Prop({ required: true, unique: true })
  endpoint: string;

  @Prop({ required: true })
  p256dh: string;

  @Prop({ required: true })
  auth: string;

  /** Helps the person recognize the device in the settings screen. */
  @Prop({ default: '' })
  userAgent: string;
}

export type PushSubscriptionDocument = HydratedDocument<PushSubscription>;

export const PushSubscriptionSchema = SchemaFactory.createForClass(PushSubscription);
