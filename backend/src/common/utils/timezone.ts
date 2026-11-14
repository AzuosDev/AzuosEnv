const PARTS_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
};

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    ...PARTS_FORMAT_OPTIONS,
    timeZone,
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value ?? '0';

    return Number.parseInt(value, 10);
  };

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour') % 24,
    minute: read('minute'),
    second: read('second'),
  };
}

/** Offset of the zone at that instant, in milliseconds (positive east of UTC). */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    date.getUTCMilliseconds(),
  );

  return asUtc - date.getTime();
}

/** UTC instant of midnight in `timeZone`, `addDays` after the day of `date`. */
export function startOfZonedDay(date: Date, timeZone: string, addDays = 0): Date {
  const parts = zonedParts(date, timeZone);
  const localMidnight = Date.UTC(parts.year, parts.month - 1, parts.day + addDays);
  const guess = new Date(localMidnight - zoneOffsetMs(date, timeZone));

  return new Date(localMidnight - zoneOffsetMs(guess, timeZone));
}

/** `YYYY-MM-DD` of the instant as read in `timeZone`. */
export function zonedDateKey(date: Date, timeZone: string): string {
  const { year, month, day } = zonedParts(date, timeZone);
  const pad = (value: number): string => String(value).padStart(2, '0');

  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Falls back to UTC when the profile holds a zone this runtime does not know. */
export function safeTimeZone(timeZone: string | undefined): string {
  if (!timeZone) {
    return 'UTC';
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());

    return timeZone;
  } catch {
    return 'UTC';
  }
}

/** UTC instant of midnight of `YYYY-MM-DD` as read in `timeZone`. */
export function startOfZonedDayKey(dateKey: string, timeZone: string): Date {
  const [year, month, day] = dateKey.split('-').map((part) => Number.parseInt(part, 10));
  const localMidnight = Date.UTC(year, month - 1, day);
  const guess = new Date(localMidnight - zoneOffsetMs(new Date(localMidnight), timeZone));

  return new Date(localMidnight - zoneOffsetMs(guess, timeZone));
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Weekday (0 = Sunday) and minutes since midnight of the instant in `timeZone`. */
export function zonedClock(
  date: Date,
  timeZone: string,
): { weekday: number; minutes: number; dateKey: string } {
  const { hour, minute } = zonedParts(date, timeZone);
  const label = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  const weekday = WEEKDAYS.indexOf(label);

  return {
    weekday: weekday < 0 ? 0 : weekday,
    minutes: hour * 60 + minute,
    dateKey: zonedDateKey(date, timeZone),
  };
}
