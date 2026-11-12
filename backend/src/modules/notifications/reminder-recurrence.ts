import { ReminderRecurrence } from './notification-fields';

/**
 * Next occurrence strictly after `now`, so a missed run does not fire the same
 * reminder many times in a row. `none` ends the reminder.
 */
export function nextOccurrence(from: Date, recurrence: ReminderRecurrence, now: Date): Date | null {
  if (recurrence === 'none') {
    return null;
  }

  const next = new Date(from);

  while (next <= now) {
    if (recurrence === 'daily') {
      next.setUTCDate(next.getUTCDate() + 1);
    } else if (recurrence === 'weekly') {
      next.setUTCDate(next.getUTCDate() + 7);
    } else {
      next.setUTCMonth(next.getUTCMonth() + 1);
    }
  }

  return next;
}
