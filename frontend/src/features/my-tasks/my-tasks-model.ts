import type { DueBucket, MyTasksSections, Task } from '@/api/types';

/** Ordem em que as seções aparecem na tela. */
export const SECTION_ORDER: DueBucket[] = ['overdue', 'today', 'next7', 'later', 'noDate'];

export const SECTION_LABEL: Record<DueBucket, string> = {
  overdue: 'Atrasadas',
  today: 'Hoje',
  next7: 'Próximas',
  later: 'Depois',
  noDate: 'Sem data',
};

/** Tom do título da seção; só atraso e hoje pedem cor. */
export const SECTION_TONE: Record<DueBucket, string> = {
  overdue: 'text-danger',
  today: 'text-warning',
  next7: 'text-ink',
  later: 'text-ink',
  noDate: 'text-muted',
};

export interface MyTasksSection {
  key: DueBucket;
  label: string;
  tone: string;
  items: Task[];
}

/** Seções na ordem fixa, já sem as vazias. */
export function sectionsOf(sections: MyTasksSections | undefined): MyTasksSection[] {
  if (!sections) {
    return [];
  }

  return SECTION_ORDER.map((key) => ({
    key,
    label: SECTION_LABEL[key],
    tone: SECTION_TONE[key],
    items: sections[key] ?? [],
  })).filter((section) => section.items.length > 0);
}

/** Quantas tarefas abertas a pessoa tem, somando as cinco seções. */
export function countMyTasks(sections: MyTasksSections | undefined): number {
  return sectionsOf(sections).reduce((total, section) => total + section.items.length, 0);
}

/** Lists que aparecem nas seções; é delas que vêm os statuses da linha. */
export function listIdsOf(sections: MyTasksSections | undefined): string[] {
  const ids = new Set<string>();

  for (const section of sectionsOf(sections)) {
    for (const task of section.items) {
      ids.add(task.listId);
    }
  }

  return [...ids];
}
