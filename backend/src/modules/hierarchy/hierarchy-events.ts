import { Types } from 'mongoose';
import { StatusGroup } from './status-templates';

export const STATUS_SET_UPDATED = 'status-set.updated';

export const SPACE_CREATED = 'space.created';
export const FOLDER_CREATED = 'folder.created';
export const LIST_CREATED = 'list.created';

/** Lets the views module create the default List and Board views of the location. */
export interface HierarchyCreatedEvent {
  workspaceId: Types.ObjectId;
  resourceType: 'space' | 'folder' | 'list';
  resourceId: Types.ObjectId;
  actorId: Types.ObjectId;
}

/** Lets the tasks module refresh the denormalized `statusGroup`. */
export interface StatusSetUpdatedEvent {
  workspaceId: Types.ObjectId;
  statusSetId: Types.ObjectId;
  statuses: { statusId: Types.ObjectId; group: StatusGroup }[];
}
