/** Entities that go to the trash and can be restored or archived. */
export const TRASH_ENTITY_TYPES = ['space', 'folder', 'list', 'task'] as const;
export type TrashEntityType = (typeof TRASH_ENTITY_TYPES)[number];

/** Days an item stays in the trash before the daily job purges it for good. */
export const TRASH_RETENTION_DAYS = 30;

export const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/** Documents read per collection before the permission filter. */
export const MAX_TRASH_SCAN = 500;

/** Items purged per collection on each cycle of the daily job. */
export const MAX_PURGE_SCAN = 200;

export function retentionCutoff(now: Date): Date {
  return new Date(now.getTime() - TRASH_RETENTION_MS);
}
