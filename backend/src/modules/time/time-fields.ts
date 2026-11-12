/** How the entry was recorded. */
export const TIME_SOURCES = ['timer', 'manual'] as const;
export type TimeSource = (typeof TIME_SOURCES)[number];

/** Where the entry is in the weekly approval flow. */
export const APPROVAL_STATUSES = ['draft', 'submitted', 'approved', 'rejected'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

/** Statuses the owner of the entry can still change. */
export const EDITABLE_APPROVAL_STATUSES: ApprovalStatus[] = ['draft', 'rejected'];

/** Metrics the workload endpoint can plot per person and day. */
export const WORKLOAD_METRICS = ['tasks', 'hours', 'points'] as const;
export type WorkloadMetric = (typeof WORKLOAD_METRICS)[number];

/** Longest window the workload and the dashboard cards accept, in days. */
export const MAX_RANGE_DAYS = 120;

/** Rows loaded per timesheet and per workload query. */
export const MAX_TIME_ENTRIES = 5000;

export function minutesBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60_000);
}

export function toHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}
