import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { RECENT_ENTITY_TYPES, RecentEntityType } from '../favorite-fields';

/** One row per user and entity; opening it again only moves `openedAt`. */
@Schema({ collection: 'recent_items', ...baseSchemaOptions })
export class RecentItem {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: String, enum: RECENT_ENTITY_TYPES, required: true })
  entityType: RecentEntityType;

  @Prop({ type: Types.ObjectId, required: true })
  entityId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  openedAt: Date;
}

export type RecentItemDocument = HydratedDocument<RecentItem>;

export const RecentItemSchema = SchemaFactory.createForClass(RecentItem);

RecentItemSchema.index({ userId: 1, workspaceId: 1, entityType: 1, entityId: 1 }, { unique: true });
RecentItemSchema.index({ userId: 1, workspaceId: 1, openedAt: -1 });
