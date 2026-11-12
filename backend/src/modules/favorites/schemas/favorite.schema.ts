import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { FAVORITE_ENTITY_TYPES, FavoriteEntityType } from '../favorite-fields';

@Schema({ collection: 'favorites', ...baseSchemaOptions })
export class Favorite {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: String, enum: FAVORITE_ENTITY_TYPES, required: true })
  entityType: FavoriteEntityType;

  @Prop({ type: Types.ObjectId, required: true })
  entityId: Types.ObjectId;

  @Prop({ required: true })
  position: string;
}

export type FavoriteDocument = HydratedDocument<Favorite>;

export const FavoriteSchema = SchemaFactory.createForClass(Favorite);

FavoriteSchema.index({ userId: 1, workspaceId: 1, entityType: 1, entityId: 1 }, { unique: true });
FavoriteSchema.index({ userId: 1, workspaceId: 1, position: 1 });
