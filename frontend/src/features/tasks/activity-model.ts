import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Activity, ActivityChange, CommentThread, TaskPriority } from '@/api/types';
import { PRIORITY_LABEL, TASK_TYPE_LABEL } from './task-fields';
import { formatMinutes } from './time-fields';

/** Rótulo de cada campo que aparece no histórico da tarefa. */
export const ACTIVITY_FIELD_LABEL: Record<string, string> = {
  name: 'nome',
  description: 'descrição',
  descriptionText: 'descrição',
  statusId: 'status',
  statusGroup: 'grupo do status',
  priority: 'prioridade',
  assigneeIds: 'responsáveis',
  watcherIds: 'seguidores',
  tagIds: 'tags',
  startAt: 'início',
  dueAt: 'prazo',
  dueHasTime: 'uso de hora',
  estimateMinutes: 'estimativa',
  points: 'pontos',
  type: 'tipo',
  customFields: 'campos personalizados',
  recurrence: 'recorrência',
  listId: 'List',
  listIds: 'Lists',
  parentTaskId: 'tarefa pai',
  position: 'ordem',
  archivedAt: 'arquivamento',
  deletedAt: 'lixeira',
  closedAt: 'fechamento',
  body: 'texto do comentário',
  bodyText: 'texto do comentário',
  resolvedAt: 'resolução',
  assigneeId: 'responsável do comentário',
  reactions: 'reações',
};

export function activityFieldLabel(field: string): string {
  return ACTIVITY_FIELD_LABEL[field] ?? field;
}

/** Resolve o nome de um id citado pelo histórico (status, pessoa ou tag). */
export type ResolveName = (id: string) => string | undefined;

const EMPTY = 'vazio';

/** Valor de uma linha do histórico em texto pt-BR. */
export function formatActivityValue(
  field: string,
  value: unknown,
  resolve: ResolveName = () => undefined,
): string {
  if (value === null || value === undefined || value === '') {
    return EMPTY;
  }

  if (Array.isArray(value)) {
    return value.length === 0
      ? EMPTY
      : value.map((item) => resolve(String(item)) ?? String(item)).join(', ');
  }

  if (typeof value === 'boolean') {
    return value ? 'sim' : 'não';
  }

  if (field === 'priority') {
    return PRIORITY_LABEL[value as TaskPriority] ?? String(value);
  }

  if (field === 'type') {
    return TASK_TYPE_LABEL[value as keyof typeof TASK_TYPE_LABEL] ?? String(value);
  }

  if (field === 'estimateMinutes') {
    return typeof value === 'number' ? formatMinutes(value) : String(value);
  }

  if (typeof value === 'object') {
    return '(conteúdo)';
  }

  if (typeof value === 'string') {
    const date = isoDate(value);

    if (date) {
      return format(date, "d 'de' MMM 'de' yyyy, HH:mm", { locale: ptBR });
    }

    return resolve(value) ?? shorten(value);
  }

  return String(value);
}

function isoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function shorten(value: string): string {
  return value.length > 80 ? `${value.slice(0, 77)}…` : value;
}

export interface ActivityLine {
  field: string;
  label: string;
  from: string;
  to: string;
}

/** Linhas de mudança da entrada, já com rótulo e valores legíveis. */
export function activityLines(activity: Activity, resolve?: ResolveName): ActivityLine[] {
  return (activity.changes ?? []).map((change: ActivityChange) => ({
    field: change.field,
    label: activityFieldLabel(change.field),
    from: formatActivityValue(change.field, change.from, resolve),
    to: formatActivityValue(change.field, change.to, resolve),
  }));
}

/** A entrada do histórico em uma frase, sem o nome de quem fez. */
export function describeActivity(activity: Activity, resolve?: ResolveName): string {
  const comment = activity.entityType === 'comment';

  if (activity.action === 'created') {
    return comment ? 'comentou na tarefa' : 'criou a tarefa';
  }

  if (activity.action === 'deleted') {
    return comment ? 'excluiu um comentário' : 'mandou a tarefa para a lixeira';
  }

  if (activity.action === 'restored') {
    return comment ? 'restaurou um comentário' : 'restaurou a tarefa';
  }

  if (activity.action === 'resolved') {
    return 'resolveu um comentário';
  }

  if (activity.action === 'unresolved') {
    return 'reabriu um comentário';
  }

  if (activity.action === 'moved') {
    const line = activityLines(activity, resolve).find((item) => item.field === 'listId');

    return line ? `moveu a tarefa para ${line.to}` : 'moveu a tarefa';
  }

  const lines = activityLines(activity, resolve);

  if (lines.length === 0) {
    return comment ? 'editou um comentário' : 'atualizou a tarefa';
  }

  const fields = lines.map((line) => line.label);
  const list =
    fields.length === 1
      ? fields[0]
      : `${fields.slice(0, -1).join(', ')} e ${fields[fields.length - 1] ?? ''}`;

  return comment ? `editou um comentário (${list ?? ''})` : `alterou ${list ?? ''}`;
}

/* Aba "Tudo" ------------------------------------------------------------- */

export type FeedEntry =
  | { kind: 'comment'; at: string; thread: CommentThread }
  | { kind: 'activity'; at: string; activity: Activity };

/**
 * Comentários e histórico na mesma linha do tempo, do mais recente para o mais
 * antigo. A linha "comentou" é descartada: o próprio comentário já está ali.
 */
export function mergeFeed(threads: CommentThread[], activities: Activity[]): FeedEntry[] {
  const entries: FeedEntry[] = [
    ...threads.map((thread) => ({
      kind: 'comment' as const,
      at: thread.comment.createdAt,
      thread,
    })),
    ...activities
      .filter((activity) => !(activity.entityType === 'comment' && activity.action === 'created'))
      .map((activity) => ({ kind: 'activity' as const, at: activity.createdAt, activity })),
  ];

  return entries.sort((left, right) => right.at.localeCompare(left.at));
}
