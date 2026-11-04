import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiHideProperty } from '@nestjs/swagger';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import {
  FORM_CONDITION_OPS,
  FORM_FIELD_TYPES,
  FormConditionOp,
  FormFieldType,
} from '../form-fields';

/** One option of a dropdown or of a labels question. */
@Schema({ _id: false })
export class FormFieldOption {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true, trim: true })
  label: string;
}

export const FormFieldOptionSchema = SchemaFactory.createForClass(FormFieldOption);

@Schema({ _id: false })
export class FormField {
  /** Stable id of the question; the answers of a submission are keyed by it. */
  @Prop({ required: true })
  id: string;

  @Prop({ required: true, trim: true })
  label: string;

  @Prop({ type: String, enum: FORM_FIELD_TYPES, required: true })
  type: FormFieldType;

  @Prop({ type: Boolean, default: false })
  required: boolean;

  @Prop({ type: [FormFieldOptionSchema], default: [] })
  options: FormFieldOption[];

  /** Field of the task this answer fills, or `customField:<id>`. */
  @Prop({ type: String, default: null })
  mapTo: string | null;
}

export const FormFieldSchema = SchemaFactory.createForClass(FormField);

/** Shows other questions once the answer of `fieldId` satisfies the operator. */
@Schema({ _id: false })
export class FormCondition {
  @Prop({ required: true })
  fieldId: string;

  @Prop({ type: String, enum: FORM_CONDITION_OPS, required: true })
  op: FormConditionOp;

  @Prop({ type: Object, default: null })
  value: unknown;

  @Prop({ type: [String], default: [] })
  showFieldIds: string[];
}

export const FormConditionSchema = SchemaFactory.createForClass(FormCondition);

@Schema({ collection: 'forms', ...baseSchemaOptions })
export class Form {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  /** List the submission becomes a task in. */
  @Prop({ type: Types.ObjectId, ref: 'List', required: true, index: true })
  listId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: String, default: null })
  description: string | null;

  @Prop({ type: [FormFieldSchema], default: [] })
  fields: FormField[];

  @Prop({ type: [FormConditionSchema], default: [] })
  conditions: FormCondition[];

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  defaultAssigneeId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, default: null })
  defaultStatusId: Types.ObjectId | null;

  /** Members notified on every submission. */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  notify: Types.ObjectId[];

  /** An inactive form answers 404 on the public routes. */
  @Prop({ type: Boolean, default: true })
  active: boolean;

  /** sha256 of the opaque token; the plain value is shown once, on creation. */
  @ApiHideProperty()
  @Prop({ type: String, required: true, select: false })
  publicTokenHash: string;

  @Prop({ type: Number, default: 0 })
  submissionCount: number;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export type FormDocument = HydratedDocument<Form>;

export const FormSchema = SchemaFactory.createForClass(Form);

FormSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    const plain = ret as unknown as Record<string, unknown>;
    plain.id = String(plain._id);
    delete plain._id;
    delete plain.__v;
    delete plain.publicTokenHash;

    return plain;
  },
});

FormSchema.index({ workspaceId: 1, deletedAt: 1, _id: -1 });
FormSchema.index({ workspaceId: 1, listId: 1, _id: -1 });
FormSchema.index({ publicTokenHash: 1 });
