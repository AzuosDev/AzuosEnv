const MINUTE_MS = 60_000;

/**
 * Dates are stored in a template as minutes from the moment it was saved, so
 * applying it later shifts the whole plan to the new anchor.
 */
export function offsetMinutesOf(date: Date | null | undefined, anchor: Date): number | null {
  if (!date) {
    return null;
  }

  return Math.round((date.getTime() - anchor.getTime()) / MINUTE_MS);
}

export function dateFromOffset(
  offsetMinutes: number | null | undefined,
  anchor: Date,
): Date | null {
  if (offsetMinutes === null || offsetMinutes === undefined || !Number.isFinite(offsetMinutes)) {
    return null;
  }

  return new Date(anchor.getTime() + offsetMinutes * MINUTE_MS);
}

/** ISO 8601 of the recalculated date, which is what the task DTOs take. */
export function isoFromOffset(
  offsetMinutes: number | null | undefined,
  anchor: Date,
): string | undefined {
  const date = dateFromOffset(offsetMinutes, anchor);

  return date ? date.toISOString() : undefined;
}
