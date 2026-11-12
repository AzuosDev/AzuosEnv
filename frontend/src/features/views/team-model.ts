import type { Activity, ActivityAction, Task } from '@/api/types';

export interface TeamStats {
  /** Tarefas em status do grupo "em andamento". */
  doing: number;
  /** Com prazo vencido e ainda não concluídas. */
  late: number;
  /** Em done ou closed. */
  done: number;
  total: number;
  /** Verdadeiro quando ainda há página para carregar: as contagens são do que veio. */
  partial: boolean;
}

function isDone(task: Task): boolean {
  return task.statusGroup === 'done' || task.statusGroup === 'closed';
}

/**
 * Contagens do card da pessoa. São das tarefas já carregadas: com mais de uma
 * página o card avisa que o número é parcial.
 */
export function teamStats(tasks: Task[], partial: boolean, now = new Date()): TeamStats {
  let doing = 0;
  let late = 0;
  let done = 0;

  for (const task of tasks) {
    if (isDone(task)) {
      done += 1;

      continue;
    }

    if (task.statusGroup === 'active') {
      doing += 1;
    }

    const due = task.dueAt ? new Date(task.dueAt) : null;

    if (due && !Number.isNaN(due.getTime()) && due.getTime() < now.getTime()) {
      late += 1;
    }
  }

  return { doing, late, done, total: tasks.length, partial };
}

/* Activity --------------------------------------------------------------- */

export type ActivityEntityFilter = 'all' | 'task' | 'comment';

export const ACTIVITY_ENTITY_OPTIONS: { value: ActivityEntityFilter; label: string }[] = [
  { value: 'all', label: 'Tudo' },
  { value: 'task', label: 'Tarefas' },
  { value: 'comment', label: 'Comentários' },
];

export const ACTIVITY_ACTION_LABEL: Record<ActivityAction, string> = {
  created: 'Criação',
  updated: 'Alteração',
  moved: 'Movimentação',
  deleted: 'Exclusão',
  restored: 'Restauração',
  resolved: 'Resolução',
  unresolved: 'Reabertura',
};

export const ACTIVITY_ACTIONS: ActivityAction[] = [
  'created',
  'updated',
  'moved',
  'deleted',
  'restored',
  'resolved',
  'unresolved',
];

export interface ActivityFilterState {
  entityType: ActivityEntityFilter;
  /** Vazio = qualquer ação. */
  actions: ActivityAction[];
  /** Vazio = qualquer pessoa. */
  actorIds: string[];
}

export const EMPTY_ACTIVITY_FILTER: ActivityFilterState = {
  entityType: 'all',
  actions: [],
  actorIds: [],
};

export function activityFilterCount(filter: ActivityFilterState): number {
  return (
    (filter.entityType === 'all' ? 0 : 1) +
    (filter.actions.length > 0 ? 1 : 0) +
    (filter.actorIds.length > 0 ? 1 : 0)
  );
}

/**
 * Filtra o feed já carregado. O endpoint só recorta por local, então tipo, ação
 * e pessoa são peneirados aqui, sobre as páginas que vieram.
 */
export function filterActivities(items: Activity[], filter: ActivityFilterState): Activity[] {
  return items.filter((item) => {
    if (filter.entityType !== 'all' && item.entityType !== filter.entityType) {
      return false;
    }

    if (filter.actions.length > 0 && !filter.actions.includes(item.action)) {
      return false;
    }

    return filter.actorIds.length === 0 || filter.actorIds.includes(item.actorId);
  });
}
