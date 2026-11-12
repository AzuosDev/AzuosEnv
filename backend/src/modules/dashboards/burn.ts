/** Cumulative sum of the day buckets, in the order of `days`. */
export function cumulative(days: string[], byDay: Record<string, number>, start = 0): number[] {
  let running = start;

  return days.map((day) => {
    running += byDay[day] ?? 0;

    return running;
  });
}

/** What is still open at the end of each day of the sprint. */
export function burndownSeries(
  days: string[],
  total: number,
  closedByDay: Record<string, number>,
  closedBefore = 0,
): number[] {
  return cumulative(days, closedByDay, closedBefore).map((closed) => Math.max(0, total - closed));
}

/** Straight line from the open total of the first day down to zero. */
export function idealSeries(days: string[], start: number): number[] {
  if (days.length <= 1) {
    return days.map(() => 0);
  }

  return days.map((_, index) => Math.round(start * (1 - index / (days.length - 1)) * 100) / 100);
}

/** Scope and delivered, both cumulative, for the burnup chart. */
export function burnupSeries(
  days: string[],
  createdByDay: Record<string, number>,
  closedByDay: Record<string, number>,
  createdBefore = 0,
  closedBefore = 0,
): { scope: number[]; completed: number[] } {
  return {
    scope: cumulative(days, createdByDay, createdBefore),
    completed: cumulative(days, closedByDay, closedBefore),
  };
}
