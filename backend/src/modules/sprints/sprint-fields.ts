/** Days a sprint of the folder lasts. */
export const MIN_SPRINT_DURATION_DAYS = 1;
export const MAX_SPRINT_DURATION_DAYS = 60;
export const DEFAULT_SPRINT_DURATION_DAYS = 14;

/** Statuses that count as delivered, so the task does not travel to the next sprint. */
export const CLOSED_STATUS_GROUPS = ['done', 'closed'] as const;

/** Leftovers moved in one close. */
export const MAX_SPRINT_MOVE = 500;

/** Sprints returned with a sprint folder. */
export const MAX_SPRINTS_PER_FOLDER = 200;

export const MAX_SPRINT_NAME_LENGTH = 80;

export const DAY_MS = 24 * 60 * 60 * 1000;
