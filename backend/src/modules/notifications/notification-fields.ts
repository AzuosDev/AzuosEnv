/** Every reason the inbox can show an entry for. */
export const NOTIFICATION_TYPES = [
  'assigned',
  'mentioned',
  'commented',
  'statusChanged',
  'dueSoon',
  'overdue',
  'reminder',
  'invited',
  'commentAssigned',
  'automation',
  'chatMention',
  'chatMessage',
  'formSubmitted',
  'aiSummary',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_ENTITY_TYPES = [
  'task',
  'comment',
  'workspace',
  'reminder',
  'message',
] as const;
export type NotificationEntityType = (typeof NOTIFICATION_ENTITY_TYPES)[number];

/** `primary` is what was aimed at the user; `other` is what reached them as a watcher. */
export const NOTIFICATION_BUCKETS = ['primary', 'other'] as const;
export type NotificationBucket = (typeof NOTIFICATION_BUCKETS)[number];

export const INBOX_TABS = ['primary', 'other', 'later', 'cleared'] as const;
export type InboxTab = (typeof INBOX_TABS)[number];

export const REMINDER_RECURRENCES = ['none', 'daily', 'weekly', 'monthly'] as const;
export type ReminderRecurrence = (typeof REMINDER_RECURRENCES)[number];

export interface NotificationChannels {
  inbox: boolean;
  email: boolean;
}

export type NotificationPreferences = Record<NotificationType, NotificationChannels>;

/** Inbox on, e-mail off: the user opts into mail per type. */
export function defaultPreferences(): NotificationPreferences {
  return Object.fromEntries(
    NOTIFICATION_TYPES.map((type) => [type, { inbox: true, email: false }]),
  ) as NotificationPreferences;
}

/** How far ahead the cron looks for a due date. */
export const DUE_SOON_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Ceiling of tasks the due-date cron reads per run. */
export const MAX_DUE_SCAN = 2000;

/** Ceiling of reminders delivered per run. */
export const MAX_REMINDER_SCAN = 500;
