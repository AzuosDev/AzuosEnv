import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import {
  CUSTOM_FIELD_SCOPES,
  CUSTOM_FIELD_TYPES,
  CustomFieldScope,
  CustomFieldType,
  DEFAULT_CURRENCY,
} from '../custom-field-types';

/** Option of a dropdown or labels field. */
@Schema({ _id: false })
export class CustomFieldOption {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop()
  color?: string;
}

export const CustomFieldOptionSchema = SchemaFactory.createForClass(CustomFieldOption);

@Schema({ _id: false })
export class CustomFieldConfig {
  @Prop({ type: [CustomFieldOptionSchema], default: undefined })
  options?: CustomFieldOption[];

  @Prop({ type: String, default: undefined })
  currency?: string;

  /** Decimal places of number and currency. */
  @Prop({ type: Number, default: undefined })
  precision?: number;

  /** Expression of a formula field, over numeric fields. */
  @Prop({ type: String, default: undefined })
  expression?: string;

  /** Target List of a relationship field. */
  @Prop({ type: Types.ObjectId, ref: 'List', default: undefined })
  relationshipListId?: Types.ObjectId;
}

export const CustomFieldConfigSchema = SchemaFactory.createForClass(CustomFieldConfig);

/** Field of a Space, Folder or List; inherited by everything below it. */
@Schema({ collection: 'custom_fields', ...baseSchemaOptions })
export class CustomField {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: String, enum: CUSTOM_FIELD_SCOPES, required: true })
  scope: CustomFieldScope;

  @Prop({ type: Types.ObjectId, required: true })
  scopeId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, enum: CUSTOM_FIELD_TYPES, required: true })
  type: CustomFieldType;

  @Prop({ type: CustomFieldConfigSchema, default: () => ({ currency: DEFAULT_CURRENCY }) })
  config: CustomFieldConfig;

  @Prop({ type: Boolean, default: false })
  required: boolean;

  @Prop({ required: true })
  position: string;
}

export type CustomFieldDocument = HydratedDocument<CustomField>;

export const CustomFieldSchema = SchemaFactory.createForClass(CustomField);

CustomFieldSchema.index({ workspaceId: 1, scope: 1, scopeId: 1, position: 1 });
