import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { TEMPLATE_TYPES, TemplateType } from '../automation-fields';

/** Snapshot of a Space, Folder, List, task, checklist or view, ready to be applied. */
@Schema({ collection: 'templates', ...baseSchemaOptions })
export class Template {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: String, enum: TEMPLATE_TYPES, required: true })
  type: TemplateType;

  @Prop({ required: true, trim: true })
  name: string;

  /** Plain JSON of the structure; dates are kept as offsets in minutes. */
  @Prop({ type: MongooseSchema.Types.Mixed, default: () => ({}) })
  content: Record<string, unknown>;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;
}

export type TemplateDocument = HydratedDocument<Template>;

export const TemplateSchema = SchemaFactory.createForClass(Template);

TemplateSchema.index({ workspaceId: 1, type: 1, _id: -1 });
