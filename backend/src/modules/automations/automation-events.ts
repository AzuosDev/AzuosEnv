import { Types } from 'mongoose';

/** Emitted whenever an automation of the workspace is written. */
export const AUTOMATIONS_CHANGED = 'automations.changed';

export interface AutomationsChangedEvent {
  workspaceId: Types.ObjectId;
}
