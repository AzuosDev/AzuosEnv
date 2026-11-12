import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ListNode, SprintFolderView, Task } from '@/api/types';

/** Situação da sprint no tempo, que é o que a tela destaca. */
export type SprintState = 'future' | 'current' | 'past' | 'closed';

export const SPRINT_STATE_LABEL: Record<SprintState, string> = {
  future: 'Próxima',
  current: 'Sprint atual',
  past: 'Encerrada',
  closed: 'Fechada',
};

/**
 * O começo e o fim da sprint são dias, não instantes: a API grava a meia-noite
 * UTC do dia. Lê-los no fuso do navegador puxaria a data para o dia anterior em
 * fusos atrás de UTC, então a data é montada a partir das partes em UTC.
 */
export function sprintDay(iso: string): Date {
  const date = new Date(iso);

  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12);
}

export function sprintState(sprint: ListNode, now = new Date()): SprintState {
  if (sprint.sprintClosedAt) {
    return 'closed';
  }

  // Comparação por dia: a data da sprint é o meio-dia do dia dela, então o
  // instante de agora deixava a sprint como 'Próxima' até meio-dia do dia em
  // que ela começa.
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const start = sprint.startDate ? sprintDay(sprint.startDate) : null;
  const end = sprint.endDate ? sprintDay(sprint.endDate) : null;

  if (start && today < start) {
    return 'future';
  }

  if (end && today > end) {
    return 'past';
  }

  return 'current';
}

/** Sprint que está correndo agora; sem ela, a próxima que ainda vai começar. */
export function currentSprint(sprints: ListNode[], now = new Date()): ListNode | null {
  const open = sprints.filter((sprint) => !sprint.sprintClosedAt);
  const running = open.find((sprint) => sprintState(sprint, now) === 'current');

  if (running) {
    return running;
  }

  const upcoming = open
    .filter((sprint) => sprintState(sprint, now) === 'future')
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));

  return upcoming[0] ?? null;
}

/** Sprint que vem depois desta na mesma pasta. */
export function nextSprint(sprints: ListNode[], sprintId: string): ListNode | null {
  const ordered = [...sprints].sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
  const index = ordered.findIndex((sprint) => sprint.id === sprintId);

  return index === -1 ? null : (ordered[index + 1] ?? null);
}

/** "26 out – 8 nov": o período da sprint em pt-BR. */
export function sprintRangeLabel(sprint: ListNode): string | null {
  if (!sprint.startDate || !sprint.endDate) {
    return null;
  }

  const start = sprintDay(sprint.startDate);
  const end = sprintDay(sprint.endDate);
  const sameMonth = start.getMonth() === end.getMonth();

  return `${format(start, sameMonth ? 'd' : 'd MMM', { locale: ptBR })} – ${format(end, 'd MMM', {
    locale: ptBR,
  })}`;
}

export interface SprintPoints {
  total: number;
  done: number;
  tasks: number;
  tasksDone: number;
}

/** Statuses que contam como entregue, como no backend. */
const CLOSED_GROUPS = ['done', 'closed'];

/** Pontos e tarefas da sprint, somados do que já veio na consulta. */
export function sprintPoints(tasks: Task[]): SprintPoints {
  let total = 0;
  let done = 0;
  let tasksDone = 0;

  for (const task of tasks) {
    const points = task.points ?? 0;

    total += points;

    if (CLOSED_GROUPS.includes(task.statusGroup)) {
      done += points;
      tasksDone += 1;
    }
  }

  return { total, done, tasks: tasks.length, tasksDone };
}

/** Quanto da sprint já foi entregue, em percentual de pontos (ou de tarefas). */
export function sprintProgress(points: SprintPoints): number {
  if (points.total > 0) {
    return Math.round((points.done / points.total) * 100);
  }

  return points.tasks === 0 ? 0 : Math.round((points.tasksDone / points.tasks) * 100);
}

/** Tarefas que viajam para a próxima sprint quando esta fecha. */
export function leftovers(tasks: Task[]): Task[] {
  return tasks.filter((task) => !CLOSED_GROUPS.includes(task.statusGroup));
}

/** Todas as sprints das pastas carregadas, em uma lista só. */
export function allSprints(folders: SprintFolderView[]): ListNode[] {
  return folders.flatMap((folder) => folder.sprints);
}

/** Lists que são a sprint atual de alguma pasta, por id. */
export function currentSprintIds(folders: SprintFolderView[], now = new Date()): Set<string> {
  const ids = new Set<string>();

  for (const folder of folders) {
    const sprint = currentSprint(folder.sprints, now);

    if (sprint) {
      ids.add(sprint.id);
    }
  }

  return ids;
}

/** A sprint de uma List, quando a List é uma sprint. */
export function sprintOf(folders: SprintFolderView[], listId: string): ListNode | null {
  return allSprints(folders).find((sprint) => sprint.id === listId) ?? null;
}

/** Recorte da sprint em dia, para o card de burndown nascer com o período certo. */
export function sprintRangeDays(sprint: ListNode): { from: string; to: string } | null {
  if (!sprint.startDate || !sprint.endDate) {
    return null;
  }

  return {
    from: format(sprintDay(sprint.startDate), 'yyyy-MM-dd'),
    to: format(sprintDay(sprint.endDate), 'yyyy-MM-dd'),
  };
}

/** Primeiro dia da próxima sprint: o dia seguinte ao fim da última. */
export function dayAfter(iso: string): string {
  return format(addDays(sprintDay(iso), 1), 'yyyy-MM-dd');
}
