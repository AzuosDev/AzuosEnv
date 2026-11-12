import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import {
  CHANNEL_LOCATION_TYPES,
  CHANNEL_TYPES,
  ChannelLocationType,
  ChannelType,
} from '../chat-fields';

@Schema({ collection: 'channels', ...baseSchemaOptions })
export class Channel {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: String, enum: CHANNEL_TYPES, required: true, default: 'channel' })
  type: ChannelType;

  /** Empty on a direct message, which is named after the other person. */
  @Prop({ type: String, default: '', trim: true })
  name: string;

  @Prop({ type: String, enum: CHANNEL_LOCATION_TYPES, required: true, default: 'workspace' })
  locationType: ChannelLocationType;

  /** null only when `locationType` is `workspace`. */
  @Prop({ type: Types.ObjectId, default: null })
  locationId: Types.ObjectId | null;

  /** A private channel is invisible to everyone outside `memberIds`. */
  @Prop({ type: Boolean, default: false })
  private: boolean;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  memberIds: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Date, default: null })
  archivedAt: Date | null;
}

export type ChannelDocument = HydratedDocument<Channel>;

export const ChannelSchema = SchemaFactory.createForClass(Channel);

ChannelSchema.index({ workspaceId: 1, locationType: 1, locationId: 1, _id: -1 });
ChannelSchema.index({ workspaceId: 1, type: 1, memberIds: 1 });
