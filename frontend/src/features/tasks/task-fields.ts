import { format, isToday, isTomorrow, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type {
  StatusGroup,
  TaskPriority,
  TaskType,
  UpdateTaskInput,
  ViewGroupBy,
} from '@/api/types';
import type { StatusTone } from '@/components/ui/status-pill';
import { toneFromColor } from '@/lib/colors';

export const PRIORITY_ORDER: TaskPriority[] = ['urgent', 'high', 'normal', 'low'];

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  normal: 'Normal',
  low: 'Baixa',
};

export const PRIORITY_OPTIONS = PRIORITY_ORDER.map((value) => ({
  value,
  label: PRIORITY_LABEL[value],
}));

export const TASK_TYPE_ORDER: TaskType[] = ['task', 'bug', 'milestone', 'meeting'];

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  task: 'Tarefa',
  bug: 'Bug',
  milestone: 'Marco',
  meeting: 'Reunião',
};

export const TASK_TYPE_OPTIONS = TASK_TYPE_ORDER.map((value) => ({
  value,
  label: TASK_TYPE_LABEL[value],
}));

/**
 * Hora que o app grava quando a data é só o dia. Meio-dia local evita que o
 * fuso jogue a data para o dia anterior ou seguinte.
 */
export const DAY_ONLY_TIME = '12:00';

/** Quebra o ISO nos dois campos do formulário, no fuso do navegador. */
export function toDayTime(iso: string | null): { day: string; time: string } {
  if (!iso) {
    return { day: '', time: '' };
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return { day: '', time: '' };
  }

  return { day: format(date, 'yyyy-MM-dd'), time: format(date, 'HH:mm') };
}

/** Junta dia e hora num ISO UTC; dia vazio apaga a data. */
export function fromDayTime(day: string, time?: string): string | null {
  if (day === '') {
    return null;
  }

  const date = new Date(`${day}T${time && time !== '' ? time : DAY_ONLY_TIME}:00`);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Data longa com a hora só quando a tarefa usa hora. */
export function formatDateField(iso: string | null, hasTime: boolean): string {
  if (!iso) {
    return 'Vazio';
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return 'Vazio';
  }

  return format(date, hasTime ? "d 'de' MMM 'de' yyyy, HH:mm" : "d 'de' MMM 'de' yyyy", {
    locale: ptBR,
  });
}

/** Grupo "sem responsável" e prioridades vazias que a API devolve por chave. */
export const UNASSIGNED_KEY = 'unassigned';
export const NO_PRIORITY_KEY = 'none';

/** O tom da pílula sai do grupo do status; a cor escolhida refina o tom. */
export function statusTone(group: StatusGroup, color: string | undefined): StatusTone {
  if (group === 'done' || group === 'closed') {
    return 'success';
  }

  return color ? toneFromColor(color) : 'neutral';
}

export type DueTone = 'danger' | 'warning' | 'muted';

/** Vermelho quando atrasou, laranja quando é hoje, neutro no resto. */
export function dueTone(dueAt: string | null, now = new Date()): DueTone {
  if (!dueAt) {
    return 'muted';
  }

  const date = new Date(dueAt);

  if (Number.isNaN(date.getTime())) {
    return 'muted';
  }

  if (isToday(date)) {
    return 'warning';
  }

  return date.getTime() < now.getTime() ? 'danger' : 'muted';
}

export const DUE_TONE_CLASS: Record<DueTone, string> = {
  danger: 'text-danger',
  warning: 'text-warning',
  muted: 'text-muted',
};

/** Prazo no formato curto pt-BR; hoje, amanhã e ontem viram palavra. */
export function formatDue(dueAt: string | null, hasTime = false): string {
  if (!dueAt) {
    return '—';
  }

  const date = new Date(dueAt);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  const time = hasTime ? ` ${format(date, 'HH:mm', { locale: ptBR })}` : '';

  if (isToday(date)) {
    return `Hoje${time}`;
  }

  if (isTomorrow(date)) {
    return `Amanhã${time}`;
  }

  if (isYesterday(date)) {
    return `Ontem${time}`;
  }

  return format(date, "d 'de' MMM", { locale: ptBR }) + time;
}

/** Prazo completo para o title do elemento. */
export function formatDueLong(dueAt: string | null): string {
  if (!dueAt) {
    return 'Sem prazo';
  }

  const date = new Date(dueAt);

  return Number.isNaN(date.getTime())
    ? 'Sem prazo'
    : format(date, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
}

/**
 * O que muda na tarefa quando ela é arrastada para outro grupo. O agrupamento
 * por prazo não tem patch: lá o drop só reordena.
 */
export function groupPatch(groupBy: ViewGroupBy, key: string): UpdateTaskInput | null {
  if (groupBy === 'status') {
    return { statusId: key };
  }

  if (groupBy === 'priority') {
    return { priority: key === NO_PRIORITY_KEY ? null : (key as TaskPriority) };
  }

  if (groupBy === 'assignee') {
    return { assigneeIds: key === UNASSIGNED_KEY ? [] : [key] };
  }

  return null;
}
