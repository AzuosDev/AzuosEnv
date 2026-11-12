import { describe, expect, it } from 'vitest';
import type { StatusGroup, TaskDependency } from '@/api/types';
import { blockingRefs, dependencyTaskIds, groupDependencies, isSettled } from './dependency-model';

function dependency(
  id: string,
  taskId: string,
  dependsOnId: string,
  type: TaskDependency['type'],
): TaskDependency {
  return {
    id,
    workspaceId: 'w1',
    taskId,
    dependsOnId,
    type,
    createdBy: 'u1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as TaskDependency;
}

const TASK = 't1';

describe('groupDependencies', () => {
  it('separa os três blocos pelo ponto de vista da tarefa aberta', () => {
    const groups = groupDependencies(
      [
        dependency('d1', TASK, 'a', 'waiting_on'),
        dependency('d2', TASK, 'b', 'blocking'),
        dependency('d3', TASK, 'c', 'linked'),
      ],
      TASK,
    );

    expect(groups.waiting.map((ref) => ref.otherTaskId)).toEqual(['a']);
    expect(groups.blocking.map((ref) => ref.otherTaskId)).toEqual(['b']);
    expect(groups.linked.map((ref) => ref.otherTaskId)).toEqual(['c']);
  });

  it('inverte o sentido quando a linha é de outra tarefa', () => {
    const groups = groupDependencies(
      [
        // "x bloqueia t1" → t1 aguarda x
        dependency('d1', 'x', TASK, 'blocking'),
        // "y aguarda t1" → t1 bloqueia y
        dependency('d2', 'y', TASK, 'waiting_on'),
        dependency('d3', 'z', TASK, 'linked'),
      ],
      TASK,
    );

    expect(groups.waiting.map((ref) => ref.otherTaskId)).toEqual(['x']);
    expect(groups.blocking.map((ref) => ref.otherTaskId)).toEqual(['y']);
    expect(groups.linked.map((ref) => ref.otherTaskId)).toEqual(['z']);
  });
});

describe('dependencyTaskIds', () => {
  it('lista os ids do outro lado sem repetir', () => {
    const groups = groupDependencies(
      [dependency('d1', TASK, 'a', 'waiting_on'), dependency('d2', TASK, 'a', 'linked')],
      TASK,
    );

    expect(dependencyTaskIds(groups)).toEqual(['a']);
  });
});

describe('isSettled', () => {
  it('só concluída e fechada deixam de bloquear', () => {
    const groups: StatusGroup[] = ['notStarted', 'active', 'done', 'closed'];

    expect(groups.map(isSettled)).toEqual([false, false, true, true]);
    expect(isSettled(undefined)).toBe(false);
  });
});

describe('blockingRefs', () => {
  const groups = groupDependencies(
    [dependency('d1', TASK, 'a', 'waiting_on'), dependency('d2', TASK, 'b', 'waiting_on')],
    TASK,
  );

  it('aponta só o que ainda não terminou', () => {
    const status = (id: string): StatusGroup | undefined => (id === 'a' ? 'done' : 'active');

    expect(blockingRefs(groups, status).map((ref) => ref.otherTaskId)).toEqual(['b']);
  });

  it('tarefa sem acesso conta como pendente', () => {
    expect(blockingRefs(groups, () => undefined)).toHaveLength(2);
  });

  it('nada bloqueia quando tudo terminou', () => {
    expect(blockingRefs(groups, () => 'closed')).toEqual([]);
  });
});
