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

/** Upload ceiling in MB; UPLOAD_MAX_MB tunes it, clamped to 1..512. */
function uploadMaxMb(): number {
  const parsed = Number(process.env.UPLOAD_MAX_MB);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 50;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), 512);
}

export const MAX_UPLOAD_MB = uploadMaxMb();
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** Every MIME type is accepted; empty or unknown ones are stored as this. */
export const DEFAULT_UPLOAD_MIME_TYPE = 'application/octet-stream';

/** Upload MIME type as it is stored: whatever the client sent, never empty. */
export function normalizeMimeType(mimeType: string | undefined): string {
  const trimmed = (mimeType ?? '').trim().toLowerCase();

  return trimmed || DEFAULT_UPLOAD_MIME_TYPE;
}

/** Deepest checklist item nesting (a parent item plus its children). */
export const MAX_CHECKLIST_ITEM_DEPTH = 2;

/** Ceiling of documents read by the feeds filtered by permission in memory. */
export const MAX_COLLABORATION_SCAN = 1000;
