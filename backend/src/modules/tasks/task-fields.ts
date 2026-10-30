export const TASK_PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_TYPES = ['task', 'bug', 'milestone', 'meeting'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const DEFAULT_TASK_TYPE: TaskType = 'task';

/** Deepest subtask chain allowed (root task included). */
export const MAX_SUBTASK_DEPTH = 5;

export const MAX_BULK_IDS = 200;

/** Custom field values a single write may carry. */
export const MAX_TASK_FIELD_VALUES = 50;

const PRIORITY_RANK: Record<TaskPriority, number> = {
  urgent: 1,
  high: 2,
  normal: 3,
  low: 4,
};

/** Tasks without priority go last. */
export function priorityRank(priority: TaskPriority | null | undefined): number {
  return priority ? PRIORITY_RANK[priority] : PRIORITY_RANK.low + 1;
}

export const PRIORITY_LABELS: Record<TaskPriority | 'none', string> = {
  urgent: 'Urgente',
  high: 'Alta',
  normal: 'Normal',
  low: 'Baixa',
  none: 'Sem prioridade',
};
