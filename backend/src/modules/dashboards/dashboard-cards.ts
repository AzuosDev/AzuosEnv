/** Cards a dashboard can hold; each one has its own aggregation. */
export const CARD_TYPES = [
  'tasksByStatus',
  'tasksByAssignee',
  'workload',
  'burndown',
  'burnup',
  'timeByClient',
  'timeByUser',
  'billable',
  'overdueList',
  'taskTable',
  'calculator',
] as const;
export type CardType = (typeof CARD_TYPES)[number];

/** Numeric fields of the task the calculator card can sum or average. */
export const CALCULATOR_TASK_FIELDS = ['estimateMinutes', 'points', 'trackedMinutes'] as const;
export type CalculatorTaskField = (typeof CALCULATOR_TASK_FIELDS)[number];

export const CALCULATOR_OPS = ['sum', 'avg'] as const;
export type CalculatorOp = (typeof CALCULATOR_OPS)[number];

/** Rows a list card returns by default. */
export const DEFAULT_CARD_LIMIT = 50;
export const MAX_CARD_LIMIT = 500;

/** Cards per dashboard. */
export const MAX_CARDS = 40;
