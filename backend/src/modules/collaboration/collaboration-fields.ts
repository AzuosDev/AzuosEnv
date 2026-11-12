/** Entities that can receive comments; page and message arrive in later stages. */
export const COMMENT_ENTITY_TYPES = ['task', 'page', 'message'] as const;
export type CommentEntityType = (typeof COMMENT_ENTITY_TYPES)[number];

/** `channel` hangs the file from a chat channel, which has no task behind it. */
export const ATTACHMENT_ENTITY_TYPES = ['task', 'comment', 'channel'] as const;
export type AttachmentEntityType = (typeof ATTACHMENT_ENTITY_TYPES)[number];

export const DEPENDENCY_TYPES = ['waiting_on', 'blocking', 'linked'] as const;
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

/** Entities whose history the activity feed records. */
export const ACTIVITY_ENTITY_TYPES = ['task', 'comment'] as const;
export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];

export const ACTIVITY_ACTIONS = [
  'created',
  'updated',
  'moved',
  'deleted',
  'restored',
  'resolved',
  'unresolved',
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** MIME types accepted on upload. */
export const ALLOWED_UPLOAD_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
  'video/mp4',
  'audio/mpeg',
] as const;

export function isAllowedMimeType(mimeType: string): boolean {
  return (ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(mimeType);
}

/** Deepest checklist item nesting (a parent item plus its children). */
export const MAX_CHECKLIST_ITEM_DEPTH = 2;

/** Ceiling of documents read by the feeds filtered by permission in memory. */
export const MAX_COLLABORATION_SCAN = 1000;
