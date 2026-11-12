import { describe, expect, it } from 'vitest';
import type { Checklist, ChecklistItem } from '@/api/types';
import {
  checklistProgress,
  flattenChecklist,
  moveChecklistPlan,
  moveItemPlan,
  progressPercent,
  replaceChecklist,
  sumProgress,
} from './checklist-model';

function item(id: string, position: string, extra: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id,
    text: id,
    done: false,
    assigneeId: null,
    position,
    parentItemId: null,
    ...extra,
  } as ChecklistItem;
}

function checklist(id: string, items: ChecklistItem[], position = 'a'): Checklist {
  return {
    id,
    workspaceId: 'w1',
    taskId: 't1',
    name: id,
    position,
    items,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as unknown as Checklist;
}

describe('flattenChecklist', () => {
  it('põe cada filho logo depois do pai, na ordem de position', () => {
    const list = checklist('c1', [
      item('b', 'b'),
      item('b1', 'a', { parentItemId: 'b' }),
      item('a', 'a'),
      item('b2', 'b', { parentItemId: 'b' }),
    ]);

    expect(flattenChecklist(list).map((entry) => [entry.item.id, entry.depth])).toEqual([
      ['a', 0],
      ['b', 0],
      ['b1', 1],
      ['b2', 1],
    ]);
  });

  it('trata filho de pai inexistente como raiz', () => {
    const list = checklist('c1', [item('x', 'a', { parentItemId: 'apagado' })]);

    expect(flattenChecklist(list)).toEqual([
      { item: expect.objectContaining({ id: 'x' }), depth: 0, parentItemId: null },
    ]);
  });
});

describe('progresso', () => {
  it('conta os itens marcados e soma várias checklists', () => {
    const one = checklist('c1', [item('a', 'a', { done: true }), item('b', 'b')]);
    const two = checklist('c2', [item('c', 'a', { done: true })]);

    expect(checklistProgress(one)).toEqual({ total: 2, done: 1 });
    expect(sumProgress([checklistProgress(one), checklistProgress(two)])).toEqual({
      total: 3,
      done: 2,
    });
    expect(progressPercent({ total: 3, done: 2 })).toBe(67);
    expect(progressPercent({ total: 0, done: 0 })).toBe(0);
  });
});

describe('moveItemPlan', () => {
  const list = checklist('c1', [
    item('a', 'a'),
    item('b', 'b'),
    item('c', 'c'),
    item('b1', 'a', { parentItemId: 'b' }),
  ]);

  it('sobe o item entre os irmãos', () => {
    expect(moveItemPlan(list, 'c', -1)).toEqual({ previousId: 'a', nextId: 'b' });
  });

  it('desce o item entre os irmãos', () => {
    expect(moveItemPlan(list, 'a', 1)).toEqual({ previousId: 'b', nextId: 'c' });
  });

  it('não move quem já está na ponta nem item desconhecido', () => {
    expect(moveItemPlan(list, 'a', -1)).toBeNull();
    expect(moveItemPlan(list, 'c', 1)).toBeNull();
    expect(moveItemPlan(list, 'b1', -1)).toBeNull();
    expect(moveItemPlan(list, 'nada', 1)).toBeNull();
  });
});

describe('moveChecklistPlan', () => {
  const lists = [checklist('c1', [], 'a'), checklist('c2', [], 'b'), checklist('c3', [], 'c')];

  it('reordena a checklist na tarefa', () => {
    expect(moveChecklistPlan(lists, 'c3', -1)).toEqual({ previousId: 'c1', nextId: 'c2' });
    expect(moveChecklistPlan(lists, 'c1', 1)).toEqual({ previousId: 'c2', nextId: 'c3' });
    expect(moveChecklistPlan(lists, 'c1', -1)).toBeNull();
  });
});

describe('replaceChecklist', () => {
  it('troca a existente e acrescenta a nova', () => {
    const lists = [checklist('c1', []), checklist('c2', [])];
    const updated = checklist('c2', [item('a', 'a')]);

    expect(replaceChecklist(lists, updated)[1]?.items).toHaveLength(1);
    expect(replaceChecklist(lists, checklist('c3', []))).toHaveLength(3);
  });
});
