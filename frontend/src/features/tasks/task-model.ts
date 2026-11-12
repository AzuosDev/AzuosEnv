import type { Task, TaskQueryResult } from '@/api/types';

/** Chave do grupo único das views sem agrupamento. */
export const ALL_KEY = 'all';

export interface TaskGroupState {
  key: string;
  label: string;
  items: Task[];
  /** Cursor do próximo lote do grupo; null quando acabou. */
  nextCursor: string | null;
}

/**
 * Junta as páginas da consulta num grupo por chave: a primeira resposta traz
 * todos os grupos, as seguintes continuam um grupo só (é o cursor que escolhe).
 */
export function mergePages(pages: TaskQueryResult[]): TaskGroupState[] {
  const groups: TaskGroupState[] = [];
  const byKey = new Map<string, TaskGroupState>();

  const upsert = (key: string, label: string, items: Task[], nextCursor: string | null): void => {
    const current = byKey.get(key);

    if (!current) {
      const group = { key, label, items: [...items], nextCursor };

      byKey.set(key, group);
      groups.push(group);

      return;
    }

    current.nextCursor = nextCursor;

    for (const task of items) {
      if (!current.items.some((item) => item.id === task.id)) {
        current.items.push(task);
      }
    }
  };

  for (const page of pages) {
    if (page.groups) {
      for (const group of page.groups) {
        upsert(group.key, group.label, group.items, group.nextCursor);
      }

      continue;
    }

    upsert(ALL_KEY, 'Tarefas', page.items ?? [], page.nextCursor ?? null);
  }

  return groups;
}

/**
 * No agrupamento por status toda coluna aparece, mesmo vazia: a consulta só
 * devolve grupo onde tem tarefa, e sem a coluna não há para onde arrastar.
 */
export function fillStatusGroups(
  groups: TaskGroupState[],
  statuses: { id: string; name: string }[],
): TaskGroupState[] {
  const byKey = new Map(groups.map((group) => [group.key, group]));
  const ordered = statuses.map(
    (status) =>
      byKey.get(status.id) ?? { key: status.id, label: status.name, items: [], nextCursor: null },
  );
  const extra = groups.filter((group) => !statuses.some((status) => status.id === group.key));

  return [...ordered, ...extra];
}

/** Tarefas de todos os grupos numa lista só, na ordem em que aparecem. */
export function flattenGroups(groups: TaskGroupState[]): Task[] {
  return groups.flatMap((group) => group.items);
}

export function countTasks(groups: TaskGroupState[]): number {
  return groups.reduce((total, group) => total + group.items.length, 0);
}

/** Id do droppable de um grupo (coluna do Quadro ou cabeçalho da Lista). */
export function groupDropId(key: string): string {
  return `group:${key}`;
}

export function groupKeyOfDropId(id: string): string | null {
  return id.startsWith('group:') ? id.slice('group:'.length) : null;
}

export interface TaskDropPlan {
  taskId: string;
  /** Grupo de destino. */
  groupKey: string;
  fromGroupKey: string;
  previousId?: string;
  nextId?: string;
}

/**
 * Traduz "arrastei A para cima de B" em grupo de destino e vizinhos, do mesmo
 * jeito que a árvore da hierarquia faz. Soltar no grupo joga para o fim dele.
 */
export function planTaskDrop(
  groups: TaskGroupState[],
  activeId: string,
  overId: string,
): TaskDropPlan | null {
  const from = groups.find((group) => group.items.some((item) => item.id === activeId));

  if (!from) {
    return null;
  }

  const groupKey = groupKeyOfDropId(overId);

  if (groupKey !== null) {
    const target = groups.find((group) => group.key === groupKey);

    if (!target) {
      return null;
    }

    const ids = target.items.filter((item) => item.id !== activeId).map((item) => item.id);
    const previousId = ids[ids.length - 1];

    if (target.key === from.key && previousId === undefined) {
      return null;
    }

    return { taskId: activeId, groupKey: target.key, fromGroupKey: from.key, previousId };
  }

  const target = groups.find((group) => group.items.some((item) => item.id === overId));

  if (!target || overId === activeId) {
    return null;
  }

  const activeIndex = from.items.findIndex((item) => item.id === activeId);
  const overIndex = target.items.findIndex((item) => item.id === overId);
  const ids = target.items.filter((item) => item.id !== activeId).map((item) => item.id);
  const at = ids.indexOf(overId);
  const after = target.key === from.key && activeIndex < overIndex;
  const previousId = after ? ids[at] : ids[at - 1];
  const nextId = after ? ids[at + 1] : ids[at];

  return { taskId: activeId, groupKey: target.key, fromGroupKey: from.key, previousId, nextId };
}
