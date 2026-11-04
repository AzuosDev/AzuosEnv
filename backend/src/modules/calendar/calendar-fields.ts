/** Where the event came from; `google` is filled by the provider of the Etapa 16. */
export const CALENDAR_SOURCES = ['local', 'google'] as const;
export type CalendarSource = (typeof CALENDAR_SOURCES)[number];

export const MAX_EVENT_TITLE_LENGTH = 200;

export const MAX_EVENT_ATTENDEES = 50;

export const MAX_RRULE_LENGTH = 500;

/** Widest window the planner and the calendar answer in one call. */
export const MAX_RANGE_DAYS = 120;

/** Events returned by a range query. */
export const MAX_EVENTS_PER_RANGE = 500;

/** Tasks the planner lists in each section. */
export const MAX_PLANNER_TASKS = 200;

/** Statuses that take a task out of the planner. */
export const CLOSED_STATUS_GROUPS = ['done', 'closed'] as const;
