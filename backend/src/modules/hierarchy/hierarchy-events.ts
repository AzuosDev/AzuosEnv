import { Types } from 'mongoose';
import { StatusGroup } from './status-templates';

export const STATUS_SET_UPDATED = 'status-set.updated';

/** Lets the tasks module refresh the denormalized `statusGroup`. */
export interface StatusSetUpdatedEvent {
  workspaceId: Types.ObjectId;
  statusSetId: Types.ObjectId;
  statuses: { statusId: Types.ObjectId; group: StatusGroup }[];
}
