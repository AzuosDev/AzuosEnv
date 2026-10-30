import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { STATUS_GROUPS, StatusGroup } from '../../hierarchy/status-templates';
import {
  DEFAULT_TASK_TYPE,
  TASK_PRIORITIES,
  TASK_TYPES,
  TaskPriority,
  TaskType,
} from '../task-fields';

/** Rich text of the description, as produced by the editor. */
export type TaskDescription = Record<string, unknown> | null;

@Schema({ collection: 'tasks', ...baseSchemaOptions })
export class Task {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'List', required: true, index: true })
  listId: Types.ObjectId;

  /** Primary list plus the secondary ones; every query filters by this field. */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'List' }], default: [] })
  listIds: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Task', default: null, index: true })
  parentTaskId: Types.ObjectId | null;

  @Prop({ required: true })
  customId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Object, default: null })
  description: TaskDescription;

  @Prop({ type: String, default: '' })
  descriptionText: string;

  @Prop({ type: Types.ObjectId, required: true })
  statusId: Types.ObjectId;

  /** Denormalized group of `statusId`, kept in sync with the status set. */
  @Prop({ type: String, enum: STATUS_GROUPS, required: true })
  statusGroup: StatusGroup;

  @Prop({ type: String, enum: TASK_PRIORITIES, default: null })
  priority: TaskPriority | null;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  assigneeIds: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  watcherIds: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Tag' }], default: [] })
  tagIds: Types.ObjectId[];

  @Prop({ type: Date, default: null })
  startAt: Date | null;

  @Prop({ type: Date, default: null })
  dueAt: Date | null;

  @Prop({ type: Boolean, default: false })
  dueHasTime: boolean;

  @Prop({ type: Number, default: null })
  estimateMinutes: number | null;

  @Prop({ type: Number, default: null })
  points: number | null;

  @Prop({ type: String, enum: TASK_TYPES, default: DEFAULT_TASK_TYPE })
  type: TaskType;

  @Prop({ required: true })
  position: string;

  @Prop({ type: Date, default: null })
  closedAt: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Date, default: null })
  archivedAt: Date | null;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export type TaskDocument = HydratedDocument<Task>;

export const TaskSchema = SchemaFactory.createForClass(Task);

TaskSchema.index({ workspaceId: 1, customId: 1 }, { unique: true });
TaskSchema.index({ workspaceId: 1, listIds: 1, statusId: 1, position: 1 });
TaskSchema.index({ workspaceId: 1, assigneeIds: 1, dueAt: 1 });
