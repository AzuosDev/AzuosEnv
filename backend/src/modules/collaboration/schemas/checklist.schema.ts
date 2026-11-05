import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';

/** Items live inside the checklist and are addressed by their own id. */
@Schema({ _id: true, ...baseSchemaOptions, timestamps: false })
export class ChecklistItem {
  @ApiHideProperty()
  _id: Types.ObjectId;

  /** Só para o contrato: o toJSON manda `id`, nunca `_id`. */
  @ApiProperty({ required: true, description: 'Id do item da checklist.' })
  id?: string;

  @Prop({ required: true, trim: true })
  text: string;

  @Prop({ type: Boolean, default: false })
  done: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  assigneeId: Types.ObjectId | null;

  @Prop({ required: true })
  position: string;

  @Prop({ type: Types.ObjectId, default: null })
  parentItemId: Types.ObjectId | null;
}

export const ChecklistItemSchema = SchemaFactory.createForClass(ChecklistItem);

@Schema({ collection: 'checklists', ...baseSchemaOptions })
export class Checklist {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Task', required: true, index: true })
  taskId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true })
  position: string;

  @Prop({ type: [ChecklistItemSchema], default: [] })
  items: ChecklistItem[];
}

export type ChecklistDocument = HydratedDocument<Checklist>;

export const ChecklistSchema = SchemaFactory.createForClass(Checklist);

ChecklistSchema.index({ workspaceId: 1, taskId: 1, position: 1 });
