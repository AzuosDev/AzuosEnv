import type { Task, TaskGroup, TaskQueryResult } from '@/api/types';
import { ALL_KEY, type TaskDropPlan } from './task-model';

/** Formato que o TanStack Query guarda para uma infinite query. */
export interface TaskPages {
  pages: TaskQueryResult[];
  pageParams: unknown[];
}

function mapGroups(
  data: TaskPages,
  change: (group: TaskGroup) => TaskGroup,
  changeFlat: (items: Task[]) => Task[],
): TaskPages {
  return {
    ...data,
    pages: data.pages.map((page) =>
      page.groups
        ? { ...page, groups: page.groups.map(change) }
        : { ...page, items: changeFlat(page.items ?? []) },
    ),
  };
}

/** Aplica o patch na tarefa onde ela estiver, sem mexer na ordem. */
export function patchTaskInPages(data: TaskPages, taskId: string, patch: Partial<Task>): TaskPages {
  const apply = (items: Task[]): Task[] =>
    items.map((item) => (item.id === taskId ? { ...item, ...patch } : item));

  return mapGroups(data, (group) => ({ ...group, items: apply(group.items) }), apply);
}

/** Aplica o patch em várias tarefas de uma vez (ação em massa). */
export function patchTasksInPages(
  data: TaskPages,
  taskIds: string[],
  patch: (task: Task) => Partial<Task>,
): TaskPages {
  const ids = new Set(taskIds);
  const apply = (items: Task[]): Task[] =>
    items.map((item) => (ids.has(item.id) ? { ...item, ...patch(item) } : item));

  return mapGroups(data, (group) => ({ ...group, items: apply(group.items) }), apply);
}

/** Tira as tarefas das páginas (exclusão e exclusão em massa). */
export function removeTasksFromPages(data: TaskPages, taskIds: string[]): TaskPages {
  const ids = new Set(taskIds);
  const apply = (items: Task[]): Task[] => items.filter((item) => !ids.has(item.id));

  return mapGroups(data, (group) => ({ ...group, items: apply(group.items) }), apply);
}

function findTask(data: TaskPages, taskId: string): Task | null {
  for (const page of data.pages) {
    for (const group of page.groups ?? []) {
      const found = group.items.find((item) => item.id === taskId);

      if (found) {
        return found;
      }
    }

    const flat = (page.items ?? []).find((item) => item.id === taskId);

    if (flat) {
      return flat;
    }
  }

  return null;
}

function insert(items: Task[], task: Task, plan: TaskDropPlan): Task[] {
  const next = items.filter((item) => item.id !== task.id);
  const previousAt = plan.previousId ? next.findIndex((item) => item.id === plan.previousId) : -1;

  if (previousAt >= 0) {
    return [...next.slice(0, previousAt + 1), task, ...next.slice(previousAt + 1)];
  }

  const nextAt = plan.nextId ? next.findIndex((item) => item.id === plan.nextId) : -1;

  if (nextAt >= 0) {
    return [...next.slice(0, nextAt), task, ...next.slice(nextAt)];
  }

  return plan.previousId ? [...next, task] : [task, ...next];
}

/**
 * Move a tarefa no cache como o arrasto pediu: sai do grupo de origem e entra no
 * destino ao lado do vizinho do plano. O patch do grupo (status, prioridade ou
 * responsável) entra junto, para a linha não piscar com o valor velho.
 */
export function moveTaskInPages(
  data: TaskPages,
  plan: TaskDropPlan,
  patch: Partial<Task> | null,
): TaskPages {
  const task = findTask(data, plan.taskId);

  if (!task) {
    return data;
  }

  const moved = patch ? { ...task, ...patch } : task;
  const targetKey = plan.groupKey;

  const holdsNeighbour = (items: Task[]): boolean =>
    items.some((item) => item.id === plan.previousId || item.id === plan.nextId);

  /** Página que recebe a tarefa: a do vizinho do plano ou a primeira do grupo. */
  const target = ((): number => {
    const candidates = data.pages
      .map((page, index) => ({ page, index }))
      .filter(({ page }) =>
        page.groups ? page.groups.some((group) => group.key === targetKey) : targetKey === ALL_KEY,
      );
    const withNeighbour = candidates.find(({ page }) =>
      page.groups
        ? (page.groups.find((group) => group.key === targetKey)?.items ?? []).some(
            (item) => item.id === plan.previousId || item.id === plan.nextId,
          )
        : holdsNeighbour(page.items ?? []),
    );

    return (withNeighbour ?? candidates[0])?.index ?? -1;
  })();

  const pages = data.pages.map((page, index) => {
    const take = (items: Task[], receive: boolean): Task[] =>
      receive ? insert(items, moved, plan) : items.filter((item) => item.id !== plan.taskId);

    if (page.groups) {
      return {
        ...page,
        groups: page.groups.map((group) =>
          group.key === targetKey && index === target
            ? { ...group, items: take(group.items, true) }
            : { ...group, items: take(group.items, false) },
        ),
      };
    }

    return { ...page, items: take(page.items ?? [], index === target) };
  });

  return { ...data, pages };
}
