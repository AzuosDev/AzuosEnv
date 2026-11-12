import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { REMINDER_RECURRENCES, ReminderRecurrence } from '../notification-fields';

@Schema({ collection: 'reminders', ...baseSchemaOptions })
export class Reminder {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  text: string;

  @Prop({ type: Date, required: true })
  remindAt: Date;

  @Prop({ type: String, enum: REMINDER_RECURRENCES, default: 'none' })
  recurrence: ReminderRecurrence;

  @Prop({ type: Types.ObjectId, ref: 'Task', default: null })
  taskId: Types.ObjectId | null;

  /** Set when the reminder was delivered and does not repeat. */
  @Prop({ type: Date, default: null })
  doneAt: Date | null;
}

export type ReminderDocument = HydratedDocument<Reminder>;

export const ReminderSchema = SchemaFactory.createForClass(Reminder);

ReminderSchema.index({ workspaceId: 1, userId: 1, doneAt: 1, _id: -1 });
ReminderSchema.index({ doneAt: 1, remindAt: 1 });
