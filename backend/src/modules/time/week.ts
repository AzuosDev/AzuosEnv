import { BadRequestException } from '@nestjs/common';
import { MAX_RANGE_DAYS } from './time-fields';

export const DAYS_PER_WEEK = 7;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD`; the calendar math runs in UTC and the zone comes later. */
export function parseDateKey(value: string, code = 'INVALID_DATE_RANGE'): Date {
  if (!DATE_KEY.test(value)) {
    throw new BadRequestException({ code, message: 'Data inválida (use YYYY-MM-DD).' });
  }

  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));

  if (Number.isNaN(date.getTime()) || date.getUTCMonth() !== month - 1) {
    throw new BadRequestException({ code, message: 'Data inválida (use YYYY-MM-DD).' });
  }

  return date;
}

export function dateKeyOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysToKey(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey);

  date.setUTCDate(date.getUTCDate() + days);

  return dateKeyOf(date);
}

/** Monday of the week that holds `dateKey`. */
export function weekStartOf(dateKey: string): string {
  const date = parseDateKey(dateKey, 'INVALID_WEEK_START');

  return addDaysToKey(dateKey, -((date.getUTCDay() + 6) % 7));
}

/** The seven day keys of the week, Monday first. */
export function weekDayKeys(weekStart: string): string[] {
  return Array.from({ length: DAYS_PER_WEEK }, (_, index) => addDaysToKey(weekStart, index));
}

/** Every day key from `from` to `to`, both included. */
export function dayKeysBetween(from: string, to: string): string[] {
  const start = parseDateKey(from);
  const end = parseDateKey(to);

  if (end.getTime() < start.getTime()) {
    throw new BadRequestException({
      code: 'INVALID_DATE_RANGE',
      message: 'A data final não pode ser anterior à inicial.',
    });
  }

  const total = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;

  if (total > MAX_RANGE_DAYS) {
    throw new BadRequestException({
      code: 'INVALID_DATE_RANGE',
      message: `O intervalo não pode passar de ${MAX_RANGE_DAYS} dias.`,
    });
  }

  return Array.from({ length: total }, (_, index) => addDaysToKey(from, index));
}
