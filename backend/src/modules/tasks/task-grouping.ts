import { startOfZonedDay } from '../../common/utils/timezone';
import { TaskSortBy } from './dto/task-query.dto';
import { TaskDocument } from './schemas/task.schema';
import { priorityRank } from './task-fields';

export const DUE_BUCKETS = ['overdue', 'today', 'next7', 'later', 'noDate'] as const;
export type DueBucket = (typeof DUE_BUCKETS)[number];

export const DUE_BUCKET_LABELS: Record<DueBucket, string> = {
  overdue: 'Atrasadas',
  today: 'Hoje',
  next7: 'Próximos 7 dias',
  later: 'Depois',
  noDate: 'Sem data',
};

export interface DayWindow {
  today: Date;
  tomorrow: Date;
  afterNext7: Date;
}

/** Day boundaries of the user timezone used by my-tasks and by dueDate groups. */
export function dayWindow(now: Date, timeZone: string): DayWindow {
  return {
    today: startOfZonedDay(now, timeZone),
    tomorrow: startOfZonedDay(now, timeZone, 1),
    afterNext7: startOfZonedDay(now, timeZone, 8),
  };
}

export function dueBucket(dueAt: Date | null | undefined, window: DayWindow): DueBucket {
  if (!dueAt) {
    return 'noDate';
  }

  if (dueAt < window.today) {
    return 'overdue';
  }

  if (dueAt < window.tomorrow) {
    return 'today';
  }

  return dueAt < window.afterNext7 ? 'next7' : 'later';
}

/**
 * Sortable string of the task for the requested order. Tasks without a value for
 * the field go last, so `1`/`9` prefixes keep the plain string comparison right.
 */
export function sortKeyOf(task: TaskDocument, sortBy: TaskSortBy): string {
  if (sortBy === 'dueAt') {
    return task.dueAt ? `1${task.dueAt.toISOString()}` : '9';
  }

  if (sortBy === 'priority') {
    return String(priorityRank(task.priority));
  }

  if (sortBy === 'createdAt') {
    const createdAt = task.get('createdAt') as Date | undefined;

    return (createdAt ?? task._id.getTimestamp()).toISOString();
  }

  if (sortBy === 'name') {
    return task.name.toLocaleLowerCase('pt-BR');
  }

  return task.position;
}

/** Order of the page: the sort key, then the id, so the cursor never repeats a task. */
export function compareByKey(
  a: { key: string; id: string },
  b: { key: string; id: string },
): number {
  if (a.key !== b.key) {
    return a.key < b.key ? -1 : 1;
  }

  if (a.id === b.id) {
    return 0;
  }

  return a.id < b.id ? -1 : 1;
}

export function isAfterCursor(
  item: { key: string; id: string },
  cursor: { key: string; id: string },
): boolean {
  return compareByKey(item, cursor) > 0;
}
