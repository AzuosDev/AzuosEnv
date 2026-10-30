import { Types } from 'mongoose';
import { NotificationBucket, NotificationType } from './notification-fields';

export const NOTIFICATION_CREATED = 'notification.created';

/** Carries the inbox entry to the realtime gateway, which pushes it to the user room. */
export interface NotificationCreatedEvent {
  workspaceId: Types.ObjectId;
  notificationId: Types.ObjectId;
  userId: Types.ObjectId;
  type: NotificationType;
  bucket: NotificationBucket;
  entityType: string;
  entityId: Types.ObjectId;
  actorId: Types.ObjectId | null;
  data: Record<string, unknown>;
}
