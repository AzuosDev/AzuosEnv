import type { Checklist, ChecklistItem, TaskProgress } from '@/api/types';

/** Item da checklist já achatado para a tela, com a profundidade do aninhamento. */
export interface FlatChecklistItem {
  item: ChecklistItem;
  depth: number;
  /** Id do item anterior entre os irmãos; usado pelo reorder. */
  parentItemId: string | null;
}

/** Só um nível de subitem: o item raiz aceita filhos, o filho não. */
export const MAX_CHECKLIST_DEPTH = 1;

function idOf(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function itemsOf(checklist: Checklist): ChecklistItem[] {
  return (checklist.items as ChecklistItem[] | undefined) ?? [];
}

/**
 * Achata os itens na ordem da tela: cada raiz seguida dos seus filhos, tudo
 * ordenado por `position`. Filho órfão (pai apagado) volta a ser raiz.
 */
export function flattenChecklist(checklist: Checklist): FlatChecklistItem[] {
  const items = itemsOf(checklist);
  const byId = new Set(items.map((item) => item.id));
  const byPosition = [...items].sort((a, b) => a.position.localeCompare(b.position));
  const children = new Map<string, ChecklistItem[]>();
  const roots: ChecklistItem[] = [];

  for (const item of byPosition) {
    const parentId = idOf(item.parentItemId);

    if (parentId && byId.has(parentId)) {
      children.set(parentId, [...(children.get(parentId) ?? []), item]);

      continue;
    }

    roots.push(item);
  }

  const flat: FlatChecklistItem[] = [];

  for (const root of roots) {
    flat.push({ item: root, depth: 0, parentItemId: null });

    for (const child of children.get(root.id) ?? []) {
      flat.push({ item: child, depth: 1, parentItemId: root.id });
    }
  }

  return flat;
}

/** Quantos itens a checklist tem e quantos estão marcados. */
export function checklistProgress(checklist: Checklist): TaskProgress {
  const items = itemsOf(checklist);

  return { total: items.length, done: items.filter((item) => item.done).length };
}

export function sumProgress(list: TaskProgress[]): TaskProgress {
  return list.reduce<TaskProgress>(
    (sum, progress) => ({ total: sum.total + progress.total, done: sum.done + progress.done }),
    { total: 0, done: 0 },
  );
}

/** Percentual inteiro de 0 a 100; checklist vazia é 0. */
export function progressPercent({ total, done }: TaskProgress): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

export interface ReorderPlan {
  previousId?: string;
  nextId?: string;
}

/**
 * Para onde o item vai quando sobe ou desce uma casa entre os próprios irmãos.
 * Devolve null quando o item já está na ponta.
 */
export function moveItemPlan(
  checklist: Checklist,
  itemId: string,
  direction: -1 | 1,
): ReorderPlan | null {
  const flat = flattenChecklist(checklist);
  const current = flat.find((entry) => entry.item.id === itemId);

  if (!current) {
    return null;
  }

  const siblings = flat.filter((entry) => entry.parentItemId === current.parentItemId);
  const index = siblings.findIndex((entry) => entry.item.id === itemId);
  const target = index + direction;

  if (target < 0 || target >= siblings.length) {
    return null;
  }

  if (direction === -1) {
    const before = siblings[target - 1]?.item.id;

    return {
      ...(before ? { previousId: before } : {}),
      nextId: siblings[target]?.item.id ?? '',
    };
  }

  const after = siblings[target + 1]?.item.id;

  return {
    previousId: siblings[target]?.item.id ?? '',
    ...(after ? { nextId: after } : {}),
  };
}

/** Mesma conta para a ordem das checklists dentro da tarefa. */
export function moveChecklistPlan(
  checklists: Checklist[],
  checklistId: string,
  direction: -1 | 1,
): ReorderPlan | null {
  const index = checklists.findIndex((checklist) => checklist.id === checklistId);
  const target = index + direction;

  if (index < 0 || target < 0 || target >= checklists.length) {
    return null;
  }

  if (direction === -1) {
    const before = checklists[target - 1]?.id;

    return {
      ...(before ? { previousId: before } : {}),
      nextId: checklists[target]?.id ?? '',
    };
  }

  const after = checklists[target + 1]?.id;

  return {
    previousId: checklists[target]?.id ?? '',
    ...(after ? { nextId: after } : {}),
  };
}

/** Troca uma checklist pela versão que a API devolveu, mantendo a ordem. */
export function replaceChecklist(checklists: Checklist[], updated: Checklist): Checklist[] {
  const known = checklists.some((checklist) => checklist.id === updated.id);

  if (!known) {
    return [...checklists, updated];
  }

  return checklists.map((checklist) => (checklist.id === updated.id ? updated : checklist));
}
