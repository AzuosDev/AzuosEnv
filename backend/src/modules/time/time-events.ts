import { Types } from 'mongoose';
import { ApprovalStatus } from './time-fields';

export const TIME_ENTRY_CREATED = 'time-entry.created';
export const TIME_ENTRY_UPDATED = 'time-entry.updated';
export const TIME_ENTRY_DELETED = 'time-entry.deleted';
export const TIMESHEET_SUBMITTED = 'timesheet.submitted';
export const TIMESHEET_REVIEWED = 'timesheet.reviewed';

export interface TimeEntryEvent {
  workspaceId: Types.ObjectId;
  entryId: Types.ObjectId;
  taskId: Types.ObjectId;
  userId: Types.ObjectId;
  actorId: Types.ObjectId;
  durationMinutes: number;
}

export interface TimesheetEvent {
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId;
  actorId: Types.ObjectId;
  weekStart: string;
  status: ApprovalStatus;
  entries: number;
}
