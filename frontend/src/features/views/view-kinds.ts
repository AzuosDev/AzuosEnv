import {
  Activity as ActivityIcon,
  CalendarDays,
  ChartGantt,
  Columns3,
  FileText,
  Gauge,
  List as ListIcon,
  MessagesSquare,
  Rows3,
  Table as TableIcon,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { ViewGroupBy, ViewSortBy, ViewType } from '@/api/types';

/** Tipos de view que o app desenha; os outros chegam nos módulos seguintes. */
export const SUPPORTED_VIEW_TYPES = [
  'list',
  'board',
  'calendar',
  'table',
  'gantt',
  'timeline',
  'workload',
  'team',
  'activity',
  'chat',
  'doc',
] as const;
export type SupportedViewType = (typeof SUPPORTED_VIEW_TYPES)[number];

export const VIEW_TYPE_LABEL: Record<SupportedViewType, string> = {
  list: 'Lista',
  board: 'Quadro',
  calendar: 'Calendário',
  table: 'Tabela',
  gantt: 'Gantt',
  timeline: 'Timeline',
  workload: 'Workload',
  team: 'Team',
  activity: 'Activity',
  chat: 'Chat',
  doc: 'Doc',
};

export const VIEW_TYPE_ICON: Record<SupportedViewType, LucideIcon> = {
  list: ListIcon,
  board: Columns3,
  calendar: CalendarDays,
  table: TableIcon,
  gantt: ChartGantt,
  timeline: Rows3,
  workload: Gauge,
  team: Users,
  activity: ActivityIcon,
  chat: MessagesSquare,
  doc: FileText,
};

export function isSupportedViewType(type: ViewType): type is SupportedViewType {
  return SUPPORTED_VIEW_TYPES.includes(type as SupportedViewType);
}

export const GROUP_BY_OPTIONS: { value: ViewGroupBy; label: string }[] = [
  { value: 'status', label: 'Status' },
  { value: 'assignee', label: 'Responsável' },
  { value: 'priority', label: 'Prioridade' },
  { value: 'dueDate', label: 'Prazo' },
  { value: 'none', label: 'Sem agrupamento' },
];

export const SORT_BY_OPTIONS: { value: ViewSortBy; label: string }[] = [
  { value: 'position', label: 'Manual' },
  { value: 'dueAt', label: 'Prazo' },
  { value: 'priority', label: 'Prioridade' },
  { value: 'name', label: 'Nome' },
  { value: 'createdAt', label: 'Criação' },
];

export const GROUP_BY_LABEL: Record<ViewGroupBy, string> = {
  status: 'Status',
  assignee: 'Responsável',
  priority: 'Prioridade',
  dueDate: 'Prazo',
  none: 'Nada',
};

export const SORT_BY_LABEL: Record<ViewSortBy, string> = {
  position: 'Manual',
  dueAt: 'Prazo',
  priority: 'Prioridade',
  name: 'Nome',
  createdAt: 'Criação',
  field: 'Campo',
};

/**
 * Views cujo agrupamento é parte do desenho: a toolbar não oferece "Agrupar por"
 * e a consulta sempre vai com essa chave.
 */
export const FIXED_GROUP_BY: Partial<Record<SupportedViewType, ViewGroupBy>> = {
  calendar: 'none',
  table: 'none',
  gantt: 'none',
  timeline: 'assignee',
  workload: 'assignee',
  team: 'assignee',
  chat: 'none',
};

/** Agrupamento padrão de cada tipo de view quando a config não diz nada. */
export const DEFAULT_GROUP_BY: Record<SupportedViewType, ViewGroupBy> = {
  list: 'status',
  board: 'status',
  calendar: 'none',
  table: 'none',
  gantt: 'none',
  timeline: 'assignee',
  workload: 'assignee',
  team: 'assignee',
  activity: 'none',
  chat: 'none',
  doc: 'none',
};

/** Agrupamento que a view vai usar de fato. */
export function groupByOf(type: SupportedViewType, groupBy: ViewGroupBy | undefined): ViewGroupBy {
  return FIXED_GROUP_BY[type] ?? groupBy ?? DEFAULT_GROUP_BY[type];
}

/** Views que leem o /tasks/query; Activity, Chat e Doc têm conteúdo próprio. */
export function usesTasks(type: SupportedViewType): boolean {
  return type !== 'activity' && type !== 'chat' && type !== 'doc';
}

/** Views que aceitam escolher colunas de campo personalizado. */
export function usesFieldColumns(type: SupportedViewType): boolean {
  return type === 'list' || type === 'table';
}

/** Views que mostram a seleção em massa das tarefas. */
export function usesSelection(type: SupportedViewType): boolean {
  return type === 'list' || type === 'board' || type === 'table';
}

/**
 * Quantas tarefas cada lote traz. Calendário, Tabela, Gantt, Timeline e
 * Workload mostram o recorte inteiro de uma vez, então pedem lote maior.
 */
export function pageSizeOf(type: SupportedViewType): number {
  return type === 'list' || type === 'board' ? 50 : 100;
}
