import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { VIEW_LOCATION_TYPES, VIEW_TYPES, ViewLocationType, ViewType } from '../view-types';

/**
 * Filters, grouping, columns and the options of each view type. Kept as a free
 * object so the front can store what only it needs.
 */
export type ViewConfig = Record<string, unknown>;

@Schema({ collection: 'views', ...baseSchemaOptions })
export class View {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: String, enum: VIEW_LOCATION_TYPES, required: true })
  locationType: ViewLocationType;

  /** null only when `locationType` is `everything`. */
  @Prop({ type: Types.ObjectId, default: null })
  locationId: Types.ObjectId | null;

  @Prop({ type: String, enum: VIEW_TYPES, required: true })
  type: ViewType;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: () => ({}) })
  config: ViewConfig;

  /** Visible only to `ownerId`. */
  @Prop({ type: Boolean, default: false })
  private: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  ownerId: Types.ObjectId;

  /** Only the owner can change or delete it. */
  @Prop({ type: Boolean, default: false })
  protected: boolean;

  @Prop({ type: Boolean, default: false })
  isDefault: boolean;

  @Prop({ type: Boolean, default: false })
  pinned: boolean;

  @Prop({ required: true })
  position: string;
}

export type ViewDocument = HydratedDocument<View>;

export const ViewSchema = SchemaFactory.createForClass(View);

ViewSchema.index({ workspaceId: 1, locationType: 1, locationId: 1, position: 1 });
