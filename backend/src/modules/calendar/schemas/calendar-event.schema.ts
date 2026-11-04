import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { CALENDAR_SOURCES, CalendarSource } from '../calendar-fields';

@Schema({ collection: 'calendar_events', ...baseSchemaOptions })
export class CalendarEvent {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  /** Owner of the event; the planner of this user is the one that shows it. */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: Date, required: true })
  start: Date;

  @Prop({ type: Date, required: true })
  end: Date;

  @Prop({ type: Boolean, default: false })
  allDay: boolean;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  attendeeIds: Types.ObjectId[];

  /** Set when the event is a time block of a task. */
  @Prop({ type: Types.ObjectId, ref: 'Task', default: null })
  taskId: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  meetUrl: string | null;

  /** RRULE of the series, as in the recurrence of a task. */
  @Prop({ type: String, default: null })
  recurrence: string | null;

  @Prop({ type: String, enum: CALENDAR_SOURCES, default: 'local' })
  source: CalendarSource;

  /** Id of the event in the external calendar, when it came from one. */
  @Prop({ type: String, default: null })
  externalId: string | null;
}

export type CalendarEventDocument = HydratedDocument<CalendarEvent>;

export const CalendarEventSchema = SchemaFactory.createForClass(CalendarEvent);

CalendarEventSchema.index({ workspaceId: 1, userId: 1, start: 1 });
CalendarEventSchema.index({ workspaceId: 1, attendeeIds: 1, start: 1 });
CalendarEventSchema.index({ workspaceId: 1, taskId: 1 });
CalendarEventSchema.index({ workspaceId: 1, source: 1, externalId: 1 });
