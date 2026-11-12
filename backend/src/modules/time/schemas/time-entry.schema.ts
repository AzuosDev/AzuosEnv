import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { APPROVAL_STATUSES, ApprovalStatus, TIME_SOURCES, TimeSource } from '../time-fields';

@Schema({ collection: 'time_entries', ...baseSchemaOptions })
export class TimeEntry {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Task', required: true })
  taskId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  start: Date;

  /** Null while the timer is running; a user has one running entry at a time. */
  @Prop({ type: Date, default: null })
  end: Date | null;

  @Prop({ type: Number, default: 0 })
  durationMinutes: number;

  @Prop({ type: Boolean, default: false })
  billable: boolean;

  @Prop({ type: String, default: '', trim: true })
  note: string;

  @Prop({ type: String, enum: TIME_SOURCES, required: true })
  source: TimeSource;

  @Prop({ type: String, enum: APPROVAL_STATUSES, default: 'draft' })
  approvalStatus: ApprovalStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  approvedBy: Types.ObjectId | null;
}

export type TimeEntryDocument = HydratedDocument<TimeEntry>;

export const TimeEntrySchema = SchemaFactory.createForClass(TimeEntry);

TimeEntrySchema.index({ workspaceId: 1, userId: 1, start: -1 });
TimeEntrySchema.index({ workspaceId: 1, taskId: 1 });
TimeEntrySchema.index({ workspaceId: 1, userId: 1, end: 1 });
TimeEntrySchema.index({ workspaceId: 1, approvalStatus: 1, start: 1 });
