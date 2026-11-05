import { Columns3, List as ListIcon, type LucideIcon } from 'lucide-react';
import type { ViewGroupBy, ViewSortBy, ViewType } from '@/api/types';

/** Tipos de view que a F6 implementa; os outros chegam nas etapas seguintes. */
export const SUPPORTED_VIEW_TYPES = ['list', 'board'] as const;
export type SupportedViewType = (typeof SUPPORTED_VIEW_TYPES)[number];

export const VIEW_TYPE_LABEL: Record<SupportedViewType, string> = {
  list: 'Lista',
  board: 'Quadro',
};

export const VIEW_TYPE_ICON: Record<SupportedViewType, LucideIcon> = {
  list: ListIcon,
  board: Columns3,
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

/** Agrupamento padrão de cada tipo de view quando a config não diz nada. */
export const DEFAULT_GROUP_BY: Record<SupportedViewType, ViewGroupBy> = {
  list: 'status',
  board: 'status',
};
