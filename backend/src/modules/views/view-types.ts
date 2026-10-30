export const VIEW_LOCATION_TYPES = ['space', 'folder', 'list', 'everything'] as const;
export type ViewLocationType = (typeof VIEW_LOCATION_TYPES)[number];

export const VIEW_TYPES = [
  'list',
  'board',
  'calendar',
  'table',
  'gantt',
  'timeline',
  'workload',
  'team',
  'activity',
  'form',
  'doc',
  'chat',
  'whiteboard',
  'embed',
  'dashboard',
  'mindmap',
  'map',
] as const;
export type ViewType = (typeof VIEW_TYPES)[number];

/** Views created with every Space, Folder and List. */
export const DEFAULT_VIEWS: { type: ViewType; name: string; isDefault: boolean }[] = [
  { type: 'list', name: 'List', isDefault: true },
  { type: 'board', name: 'Board', isDefault: false },
];

export const EXPORT_FORMATS = ['csv', 'xlsx'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** Columns the export knows besides the custom fields (`field:<id>`). */
export const TASK_COLUMNS = [
  'customId',
  'name',
  'status',
  'priority',
  'assignees',
  'tags',
  'startAt',
  'dueAt',
  'estimateMinutes',
  'points',
  'type',
  'createdAt',
] as const;
export type TaskColumn = (typeof TASK_COLUMNS)[number];

export const TASK_COLUMN_LABELS: Record<TaskColumn, string> = {
  customId: 'ID',
  name: 'Tarefa',
  status: 'Status',
  priority: 'Prioridade',
  assignees: 'Responsáveis',
  tags: 'Tags',
  startAt: 'Início',
  dueAt: 'Prazo',
  estimateMinutes: 'Estimativa (min)',
  points: 'Pontos',
  type: 'Tipo',
  createdAt: 'Criada em',
};

export const DEFAULT_EXPORT_COLUMNS: TaskColumn[] = [
  'customId',
  'name',
  'status',
  'priority',
  'assignees',
  'startAt',
  'dueAt',
  'tags',
];

export const FIELD_COLUMN_PREFIX = 'field:';

export const MAX_VIEW_COLUMNS = 60;
