import { BadRequestException } from '@nestjs/common';
import { RRule, rrulestr } from 'rrule';

export const RECURRENCE_MODES = ['onComplete', 'onSchedule'] as const;
export type RecurrenceMode = (typeof RECURRENCE_MODES)[number];

export const MAX_RRULE_LENGTH = 500;

/** Tasks scanned by the scheduled recurrence cycle. */
export const MAX_RECURRENCE_SCAN = 500;

export interface RecurrenceInput {
  rrule: string;
  mode: RecurrenceMode;
  createNew: boolean;
}

/** New dates of the next occurrence, keeping the distance between start and due. */
export interface NextOccurrence {
  startAt: Date | null;
  dueAt: Date;
}

function invalidRecurrence(): BadRequestException {
  return new BadRequestException({
    code: 'INVALID_RECURRENCE',
    message: 'Regra de recorrência inválida.',
  });
}

/**
 * Parses an iCalendar recurrence rule (with or without the `RRULE:` prefix).
 * `dtstart` anchors a rule that does not carry its own DTSTART.
 */
export function parseRecurrence(rule: string, dtstart: Date): RRule {
  const trimmed = rule.trim();

  if (trimmed.length === 0 || trimmed.length > MAX_RRULE_LENGTH) {
    throw invalidRecurrence();
  }

  let parsed: ReturnType<typeof rrulestr>;

  try {
    parsed = rrulestr(trimmed, { dtstart });
  } catch {
    throw invalidRecurrence();
  }

  if (!(parsed instanceof RRule)) {
    throw invalidRecurrence();
  }

  return parsed;
}

/** Validates the rule at write time; the parsed object is thrown away. */
export function assertRecurrence(rule: string): void {
  parseRecurrence(rule, new Date());
}

/**
 * First occurrence strictly after `after`. The rule is anchored on the current
 * due date so a weekly task keeps falling on the same weekday.
 */
export function nextOccurrenceDate(rule: string, anchor: Date, after: Date): Date | null {
  return parseRecurrence(rule, anchor).after(after, false);
}

/**
 * Dates of the next occurrence of the task. `dueAt` is the anchor; `startAt` is
 * shifted by the same amount so the duration of the task is preserved.
 */
export function nextOccurrence(
  rule: string,
  dates: { startAt: Date | null; dueAt: Date | null },
  now: Date,
): NextOccurrence | null {
  const anchor = dates.dueAt ?? dates.startAt ?? now;
  const after = anchor > now ? anchor : now;
  const dueAt = nextOccurrenceDate(rule, anchor, after);

  if (!dueAt) {
    return null;
  }

  const shift = dueAt.getTime() - anchor.getTime();

  return {
    dueAt,
    startAt: dates.startAt ? new Date(dates.startAt.getTime() + shift) : null,
  };
}
