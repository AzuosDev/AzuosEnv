import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { TARGET_TYPES, TargetType } from '../goals-fields';

@Schema({ collection: 'targets', ...baseSchemaOptions })
export class Target {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Goal', required: true, index: true })
  goalId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, enum: TARGET_TYPES, required: true })
  type: TargetType;

  @Prop({ type: Number, default: 0 })
  start: number;

  @Prop({ type: Number, required: true })
  target: number;

  /** Kept by hand, except in a `tasks` target, where the events recompute it. */
  @Prop({ type: Number, default: 0 })
  current: number;

  @Prop({ type: String, default: null })
  unit: string | null;

  /** Tasks counted by a `tasks` target; empty when it follows a whole List. */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Task' }], default: [] })
  taskIds: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'List', default: null })
  listId: Types.ObjectId | null;
}

export type TargetDocument = HydratedDocument<Target>;

export const TargetSchema = SchemaFactory.createForClass(Target);

TargetSchema.index({ workspaceId: 1, goalId: 1, _id: 1 });
TargetSchema.index({ workspaceId: 1, type: 1, taskIds: 1 });
TargetSchema.index({ workspaceId: 1, type: 1, listId: 1 });
