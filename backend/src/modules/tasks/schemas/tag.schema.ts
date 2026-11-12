import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';

@Schema({ collection: 'tags', ...baseSchemaOptions })
export class Tag {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Space', required: true, index: true })
  spaceId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  color: string;
}

export type TagDocument = HydratedDocument<Tag>;

export const TagSchema = SchemaFactory.createForClass(Tag);

TagSchema.index({ workspaceId: 1, spaceId: 1, name: 1 });
