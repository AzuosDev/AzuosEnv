import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';

/** How far a user has read a channel; everything newer counts as unread. */
@Schema({ collection: 'channel_reads', ...baseSchemaOptions })
export class ChannelRead {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Channel', required: true })
  channelId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  lastReadAt: Date;
}

export type ChannelReadDocument = HydratedDocument<ChannelRead>;

export const ChannelReadSchema = SchemaFactory.createForClass(ChannelRead);

ChannelReadSchema.index({ channelId: 1, userId: 1 }, { unique: true });
ChannelReadSchema.index({ workspaceId: 1, userId: 1 });
