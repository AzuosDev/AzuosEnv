import { describe, expect, it } from 'vitest';
import type { Task, TaskQueryResult } from '@/api/types';
import { moveTaskInPages, patchTaskInPages, removeTasksFromPages } from './task-cache';
import { ALL_KEY, fillStatusGroups, groupDropId, mergePages, planTaskDrop } from './task-model';

function task(id: string): Task {
  return { id, name: id } as Task;
}

function group(key: string, ids: string[], nextCursor: string | null = null) {
  return { key, label: key, items: ids.map(task), nextCursor };
}

describe('mergePages', () => {
  it('mantém a ordem dos grupos da primeira página e junta a continuação', () => {
    const pages: TaskQueryResult[] = [
      { groups: [group('todo', ['a', 'b'], 'c1'), group('doing', ['c'])] },
      { groups: [group('todo', ['d'], null)] },
    ];
    const merged = mergePages(pages);

    expect(merged.map((item) => item.key)).toEqual(['todo', 'doing']);
    expect(merged[0]?.items.map((item) => item.id)).toEqual(['a', 'b', 'd']);
    expect(merged[0]?.nextCursor).toBeNull();
  });

  it('não repete tarefa que vem de novo na página seguinte', () => {
    const merged = mergePages([
      { groups: [group('todo', ['a'], 'c1')] },
      { groups: [group('todo', ['a', 'b'])] },
    ]);

    expect(merged[0]?.items.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('view sem agrupamento vira um grupo único', () => {
    const merged = mergePages([
      { items: [task('a')], nextCursor: 'c1' },
      { items: [task('b')], nextCursor: null },
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.key).toBe(ALL_KEY);
    expect(merged[0]?.items.map((item) => item.id)).toEqual(['a', 'b']);
  });
});

describe('fillStatusGroups', () => {
  const statuses = [
    { id: 'todo', name: 'A fazer' },
    { id: 'doing', name: 'Em andamento' },
    { id: 'done', name: 'Concluído' },
  ];

  it('mostra toda coluna de status na ordem do conjunto, mesmo vazia', () => {
    const filled = fillStatusGroups([group('doing', ['a'])], statuses);

    expect(filled.map((item) => item.key)).toEqual(['todo', 'doing', 'done']);
    expect(filled.map((item) => item.items.length)).toEqual([0, 1, 0]);
    expect(filled[0]?.label).toBe('A fazer');
  });

  it('mantém no fim o grupo que não é mais status do conjunto', () => {
    const filled = fillStatusGroups([group('removido', ['a'])], statuses);

    expect(filled.map((item) => item.key)).toEqual(['todo', 'doing', 'done', 'removido']);
  });
});

describe('planTaskDrop', () => {
  const groups = [group('todo', ['a', 'b', 'c']), group('doing', ['d'])];

  it('para baixo no mesmo grupo entra depois do alvo', () => {
    expect(planTaskDrop(groups, 'a', 'c')).toEqual({
      taskId: 'a',
      groupKey: 'todo',
      fromGroupKey: 'todo',
      previousId: 'c',
      nextId: undefined,
    });
  });

  it('para cima no mesmo grupo entra antes do alvo', () => {
    expect(planTaskDrop(groups, 'c', 'b')).toEqual({
      taskId: 'c',
      groupKey: 'todo',
      fromGroupKey: 'todo',
      previousId: 'a',
      nextId: 'b',
    });
  });

  it('em outro grupo entra antes do alvo e marca a troca de grupo', () => {
    const plan = planTaskDrop(groups, 'a', 'd');

    expect(plan).toEqual({
      taskId: 'a',
      groupKey: 'doing',
      fromGroupKey: 'todo',
      previousId: undefined,
      nextId: 'd',
    });
  });

  it('soltar no grupo joga para o fim dele', () => {
    expect(planTaskDrop(groups, 'a', groupDropId('doing'))).toEqual({
      taskId: 'a',
      groupKey: 'doing',
      fromGroupKey: 'todo',
      previousId: 'd',
    });
  });

  it('ignora o alvo inválido e o próprio item', () => {
    expect(planTaskDrop(groups, 'a', 'a')).toBeNull();
    expect(planTaskDrop(groups, 'a', 'zzz')).toBeNull();
    expect(planTaskDrop(groups, 'zzz', 'a')).toBeNull();
  });
});

describe('cache otimista', () => {
  const data = {
    pages: [{ groups: [group('todo', ['a', 'b']), group('doing', ['c'])] }],
    pageParams: [undefined],
  };

  it('patch troca os campos da tarefa sem mexer na ordem', () => {
    const next = patchTaskInPages(data, 'b', { name: 'novo' });

    expect(next.pages[0]?.groups?.[0]?.items.map((item) => item.name)).toEqual(['a', 'novo']);
  });

  it('exclusão tira a tarefa de todos os grupos', () => {
    const next = removeTasksFromPages(data, ['a', 'c']);

    expect(next.pages[0]?.groups?.[0]?.items).toHaveLength(1);
    expect(next.pages[0]?.groups?.[1]?.items).toHaveLength(0);
  });

  it('mover entre grupos sai de um e entra no outro uma única vez', () => {
    const plan = planTaskDrop(mergePages(data.pages), 'a', 'c');

    if (!plan) {
      throw new Error('plano do arrasto');
    }

    const next = moveTaskInPages(data, plan, { statusId: 'doing' });
    const [todo, doing] = next.pages[0]?.groups ?? [];

    expect(todo?.items.map((item) => item.id)).toEqual(['b']);
    expect(doing?.items.map((item) => item.id)).toEqual(['a', 'c']);
    expect(doing?.items[0]?.statusId).toBe('doing');
  });
});
