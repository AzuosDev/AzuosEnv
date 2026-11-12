import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { DEFAULT_GOAL_COLOR } from '../goals-fields';

@Schema({ collection: 'goal_folders', ...baseSchemaOptions })
export class GoalFolder {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, default: DEFAULT_GOAL_COLOR })
  color: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export type GoalFolderDocument = HydratedDocument<GoalFolder>;

export const GoalFolderSchema = SchemaFactory.createForClass(GoalFolder);

GoalFolderSchema.index({ workspaceId: 1, deletedAt: 1, _id: -1 });
