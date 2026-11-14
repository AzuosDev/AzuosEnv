import { safeTimeZone, zonedClock } from '../../common/utils/timezone';

/** One `HH:mm`–`HH:mm` window of a day of attendance. */
export interface WaHoursRangeLike {
  start: string;
  end: string;
}

export interface WaHoursDayLike {
  /** 0 = Sunday. */
  weekday: number;
  ranges: WaHoursRangeLike[];
}

export interface WaHolidayLike {
  /** `YYYY-MM-DD`, read in the zone of the attendance. */
  date: string;
}

export interface WaBotHoursLike {
  enabled: boolean;
  /** Empty falls back to the zone handed in by the caller. */
  timezone: string;
  days: WaHoursDayLike[];
  holidays: WaHolidayLike[];
}

/** Minutes since midnight of an `HH:mm`, or null when it does not parse. */
export function minutesOfDay(time: string): number | null {
  const match = /^([0-9]{1,2}):([0-9]{2})$/.exec(time.trim());

  if (!match) {
    return null;
  }

  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);

  if (hour > 24 || minute > 59 || (hour === 24 && minute > 0)) {
    return null;
  }

  return hour * 60 + minute;
}

/**
 * True when `at` falls inside the attendance. Hours turned off means always open;
 * a holiday closes the whole day; a range that ends before it starts crosses
 * midnight and stays open until the end of the day.
 */
export function isWithinWaHours(
  hours: WaBotHoursLike | null | undefined,
  at: Date,
  fallbackTimeZone: string,
): boolean {
  if (!hours || !hours.enabled) {
    return true;
  }

  const timeZone = safeTimeZone(hours.timezone || fallbackTimeZone);
  const { weekday, minutes, dateKey } = zonedClock(at, timeZone);

  if (hours.holidays.some((holiday) => holiday.date === dateKey)) {
    return false;
  }

  const day = hours.days.find((one) => one.weekday === weekday);

  if (!day || day.ranges.length === 0) {
    return false;
  }

  return day.ranges.some((range) => {
    const start = minutesOfDay(range.start);
    const end = minutesOfDay(range.end);

    if (start === null || end === null) {
      return false;
    }

    return end > start ? minutes >= start && minutes < end : minutes >= start;
  });
}
