import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { DEFAULT_GOAL_COLOR } from '../goals-fields';

@Schema({ collection: 'goals', ...baseSchemaOptions })
export class Goal {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'GoalFolder', default: null })
  folderId: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, default: null })
  description: string | null;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  ownerIds: Types.ObjectId[];

  @Prop({ type: Date, default: null })
  dueDate: Date | null;

  @Prop({ type: String, default: DEFAULT_GOAL_COLOR })
  color: string;

  /** A private goal is visible only to who created it and to its owners. */
  @Prop({ type: Boolean, default: false })
  private: boolean;

  @Prop({ type: Date, default: null })
  completedAt: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export type GoalDocument = HydratedDocument<Goal>;

export const GoalSchema = SchemaFactory.createForClass(Goal);

GoalSchema.index({ workspaceId: 1, deletedAt: 1, _id: -1 });
GoalSchema.index({ workspaceId: 1, folderId: 1, _id: -1 });
GoalSchema.index({ workspaceId: 1, ownerIds: 1 });
