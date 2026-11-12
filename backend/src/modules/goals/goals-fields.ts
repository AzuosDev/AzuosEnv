/** What a target measures; `tasks` is kept in sync by the domain events. */
export const TARGET_TYPES = ['number', 'boolean', 'currency', 'tasks'] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

export const MAX_GOAL_NAME_LENGTH = 200;

export const MAX_GOAL_OWNERS = 50;

/** Tasks a single target of the type `tasks` can point at. */
export const MAX_TARGET_TASKS = 500;

/** Targets a goal can hold. */
export const MAX_TARGETS_PER_GOAL = 50;

/** Statuses that count as delivered in a target of the type `tasks`. */
export const CLOSED_STATUS_GROUPS = ['done', 'closed'] as const;

export const DEFAULT_GOAL_COLOR = '#2563EB';
