import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { STATUS_GROUPS, StatusGroup } from '../../hierarchy/status-templates';
import { RECURRENCE_MODES, RecurrenceMode } from '../recurrence';
import {
  DEFAULT_TASK_TYPE,
  TASK_PRIORITIES,
  TASK_TYPES,
  TaskPriority,
  TaskType,
} from '../task-fields';

/** Rich text of the description, as produced by the editor. */
export type TaskDescription = Record<string, unknown> | null;

/** Value of a custom field, validated by the type of the field. */
@Schema({ _id: false })
export class TaskCustomFieldValue {
  @Prop({ type: Types.ObjectId, ref: 'CustomField', required: true })
  fieldId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  value: unknown;
}

export const TaskCustomFieldValueSchema = SchemaFactory.createForClass(TaskCustomFieldValue);

/** Recurrence of the task: an iCalendar rule plus how the next occurrence is made. */
@Schema({ _id: false })
export class TaskRecurrence {
  @Prop({ required: true, trim: true })
  rrule: string;

  @Prop({ type: String, enum: RECURRENCE_MODES, required: true })
  mode: RecurrenceMode;

  /** True spawns the next occurrence as a new task; false reopens this one. */
  @Prop({ type: Boolean, default: true })
  createNew: boolean;
}

export const TaskRecurrenceSchema = SchemaFactory.createForClass(TaskRecurrence);

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

  /** Denormalized sum of the time entries of the task, in minutes. */
  @Prop({ type: Number, default: 0 })
  trackedMinutes: number;

  @Prop({ type: String, enum: TASK_TYPES, default: DEFAULT_TASK_TYPE })
  type: TaskType;

  @Prop({ type: [TaskCustomFieldValueSchema], default: [] })
  customFields: TaskCustomFieldValue[];

  @Prop({ type: TaskRecurrenceSchema, default: null })
  recurrence: TaskRecurrence | null;

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
TaskSchema.index({ workspaceId: 1, 'customFields.fieldId': 1 });
TaskSchema.index({ workspaceId: 1, deletedAt: 1 });
TaskSchema.index({ 'recurrence.mode': 1, dueAt: 1 });

// A collection accepts a single text index; this one serves the global search.
TaskSchema.index(
  { name: 'text', descriptionText: 'text' },
  { name: 'task_text', default_language: 'portuguese', weights: { name: 10, descriptionText: 1 } },
);
