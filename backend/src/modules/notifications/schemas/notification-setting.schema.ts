import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { NotificationChannels } from '../notification-fields';

/**
 * Channels the user wants per notification type. Only what was changed is stored;
 * the service merges the row with the defaults on every read.
 */
@Schema({ collection: 'notification_settings', ...baseSchemaOptions })
export class NotificationSetting {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ type: Object, default: {} })
  types: Record<string, NotificationChannels>;
}

export type NotificationSettingDocument = HydratedDocument<NotificationSetting>;

export const NotificationSettingSchema = SchemaFactory.createForClass(NotificationSetting);
