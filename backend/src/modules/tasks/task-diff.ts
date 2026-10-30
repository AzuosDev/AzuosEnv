import { Types } from 'mongoose';
import { StatusGroup } from '../hierarchy/status-templates';
import { TaskChanges } from './task-events';

/** A task in these groups is closed and carries `closedAt`. */
export function isClosedGroup(group: StatusGroup): boolean {
  return group === 'done' || group === 'closed';
}

/** Comparable form of a field value, so the diff ignores ObjectId/Date identity. */
export function normalizeValue(value: unknown): unknown {
  if (value === undefined || value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Types.ObjectId) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }

  return value;
}

export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalizeValue(a)) === JSON.stringify(normalizeValue(b));
}

/** Records the change and answers whether the field really changed. */
export function recordChange(
  changes: TaskChanges,
  field: string,
  from: unknown,
  to: unknown,
): boolean {
  if (sameValue(from, to)) {
    return false;
  }

  changes[field] = { from: normalizeValue(from), to: normalizeValue(to) };

  return true;
}

export function toDate(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}
