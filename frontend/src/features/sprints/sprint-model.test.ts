import { describe, expect, it } from 'vitest';
import type { ListNode, SprintFolderView, Task } from '@/api/types';
import {
  currentSprint,
  currentSprintIds,
  dayAfter,
  leftovers,
  nextSprint,
  sprintPoints,
  sprintProgress,
  sprintRangeDays,
  sprintRangeLabel,
  sprintState,
} from './sprint-model';

function sprint(partial: Partial<ListNode>): ListNode {
  return {
    id: 's1',
    workspaceId: 'w1',
    spaceId: 'sp1',
    folderId: 'f1',
    name: 'Sprint 1',
    statusSetId: 'st1',
    position: 'a0',
    sprintFolderId: 'sf1',
    startDate: '2026-10-26T00:00:00.000Z',
    endDate: '2026-11-08T23:59:59.000Z',
    sprintClosedAt: null,
    archivedAt: null,
    deletedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...partial,
  } as ListNode;
}

function task(points: number | null, statusGroup: string): Task {
  return { id: `t${String(points)}${statusGroup}`, points, statusGroup } as unknown as Task;
}

describe('sprintState', () => {
  it('diz se a sprint está correndo, por vir, passada ou fechada', () => {
    const now = new Date('2026-11-01T12:00:00.000Z');

    expect(sprintState(sprint({}), now)).toBe('current');
    expect(sprintState(sprint({ startDate: '2026-12-01T00:00:00.000Z' }), now)).toBe('future');
    expect(sprintState(sprint({ endDate: '2026-10-01T00:00:00.000Z' }), now)).toBe('past');
    expect(sprintState(sprint({ sprintClosedAt: '2026-11-01T00:00:00.000Z' }), now)).toBe('closed');
  });
});

describe('currentSprint', () => {
  const now = new Date('2026-11-01T12:00:00.000Z');

  it('pega a que está correndo', () => {
    const sprints = [
      sprint({ id: 's1', sprintClosedAt: '2026-10-25T00:00:00.000Z' }),
      sprint({ id: 's2' }),
    ];

    expect(currentSprint(sprints, now)?.id).toBe('s2');
  });

  it('sem nenhuma correndo, pega a próxima a começar', () => {
    const sprints = [
      sprint({
        id: 's3',
        startDate: '2026-12-10T00:00:00.000Z',
        endDate: '2026-12-24T00:00:00.000Z',
      }),
      sprint({
        id: 's2',
        startDate: '2026-11-20T00:00:00.000Z',
        endDate: '2026-12-04T00:00:00.000Z',
      }),
    ];

    expect(currentSprint(sprints, now)?.id).toBe('s2');
  });

  it('sem sprint aberta, não há atual', () => {
    expect(currentSprint([sprint({ sprintClosedAt: '2026-10-01T00:00:00.000Z' })], now)).toBeNull();
  });

  it('a pasta contribui com a sprint atual dela', () => {
    const views = [
      { sprintFolder: { id: 'sf1' }, sprints: [sprint({ id: 's2' })] },
    ] as SprintFolderView[];

    expect([...currentSprintIds(views, now)]).toEqual(['s2']);
  });
});

describe('nextSprint e datas', () => {
  it('a próxima é a seguinte em ordem de início', () => {
    const sprints = [
      sprint({ id: 's1', startDate: '2026-10-26T00:00:00.000Z' }),
      sprint({ id: 's2', startDate: '2026-11-09T00:00:00.000Z' }),
    ];

    expect(nextSprint(sprints, 's1')?.id).toBe('s2');
    expect(nextSprint(sprints, 's2')).toBeNull();
  });

  it('o período aparece em pt-BR e em dia', () => {
    expect(sprintRangeLabel(sprint({}))).toContain('–');
    expect(sprintRangeDays(sprint({}))?.from).toBe('2026-10-26');
    expect(sprintRangeLabel(sprint({ startDate: null, endDate: null }))).toBeNull();
  });

  it('a próxima sprint começa no dia seguinte ao fim', () => {
    expect(dayAfter('2026-11-08T00:00:00.000Z')).toBe('2026-11-09');
  });
});

describe('pontos da sprint', () => {
  const tasks = [task(5, 'done'), task(3, 'active'), task(null, 'closed'), task(2, 'notStarted')];

  it('soma os pontos e separa o que foi entregue', () => {
    expect(sprintPoints(tasks)).toEqual({ total: 10, done: 5, tasks: 4, tasksDone: 2 });
  });

  it('o progresso vai por pontos e cai para tarefas quando não há pontos', () => {
    expect(sprintProgress(sprintPoints(tasks))).toBe(50);
    expect(sprintProgress(sprintPoints([task(null, 'done'), task(null, 'active')]))).toBe(50);
    expect(sprintProgress(sprintPoints([]))).toBe(0);
  });

  it('as pendências são o que não está entregue', () => {
    expect(leftovers(tasks)).toHaveLength(2);
  });
});
