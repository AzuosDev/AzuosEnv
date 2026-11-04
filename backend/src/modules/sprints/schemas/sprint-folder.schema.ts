import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { DEFAULT_SPRINT_DURATION_DAYS } from '../sprint-fields';

/**
 * Settings of the ClickApp sprints. Every sprint of the folder is a List inside
 * the hierarchy Folder of `folderId`, with its own startDate and endDate.
 */
@Schema({ collection: 'sprint_folders', ...baseSchemaOptions })
export class SprintFolder {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Space', required: true, index: true })
  spaceId: Types.ObjectId;

  /** Folder of the hierarchy that holds the sprints of this folder. */
  @Prop({ type: Types.ObjectId, ref: 'Folder', required: true })
  folderId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Number, default: DEFAULT_SPRINT_DURATION_DAYS })
  durationDays: number;

  /** First day of the first sprint; the next ones follow the duration. */
  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export type SprintFolderDocument = HydratedDocument<SprintFolder>;

export const SprintFolderSchema = SchemaFactory.createForClass(SprintFolder);

SprintFolderSchema.index({ workspaceId: 1, deletedAt: 1, _id: -1 });
SprintFolderSchema.index({ workspaceId: 1, folderId: 1 }, { unique: true });
