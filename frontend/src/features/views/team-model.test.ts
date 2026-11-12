import { describe, expect, it } from 'vitest';
import type { Activity, Task } from '@/api/types';
import {
  EMPTY_ACTIVITY_FILTER,
  activityFilterCount,
  filterActivities,
  teamStats,
} from './team-model';

const NOW = new Date('2026-11-18T12:00:00');

function task(id: string, statusGroup: Task['statusGroup'], dueAt: string | null): Task {
  return { id, name: id, statusGroup, dueAt } as Task;
}

function activity(
  id: string,
  entityType: Activity['entityType'],
  action: Activity['action'],
  actorId: string,
): Activity {
  return { id, entityType, action, actorId, changes: [] } as unknown as Activity;
}

describe('teamStats', () => {
  it('conta em andamento, atrasadas e concluídas', () => {
    const stats = teamStats(
      [
        task('a', 'active', '2026-11-10T12:00:00.000Z'),
        task('b', 'active', '2026-11-30T12:00:00.000Z'),
        task('c', 'notStarted', '2026-11-01T12:00:00.000Z'),
        task('d', 'done', '2026-11-01T12:00:00.000Z'),
        task('e', 'closed', null),
      ],
      false,
      NOW,
    );

    expect(stats.doing).toBe(2);
    expect(stats.late).toBe(2);
    expect(stats.done).toBe(2);
    expect(stats.total).toBe(5);
    expect(stats.partial).toBe(false);
  });

  it('concluída com prazo vencido não conta como atrasada', () => {
    expect(teamStats([task('a', 'done', '2020-01-01T12:00:00.000Z')], false, NOW).late).toBe(0);
  });
});

describe('filtros da Activity', () => {
  const items = [
    activity('1', 'task', 'created', 'u1'),
    activity('2', 'task', 'updated', 'u2'),
    activity('3', 'comment', 'created', 'u1'),
  ];

  it('sem filtro passa tudo', () => {
    expect(filterActivities(items, EMPTY_ACTIVITY_FILTER)).toHaveLength(3);
    expect(activityFilterCount(EMPTY_ACTIVITY_FILTER)).toBe(0);
  });

  it('filtra por tipo, ação e pessoa e conta os filtros ligados', () => {
    const filter = { entityType: 'task' as const, actions: ['created' as const], actorIds: ['u1'] };

    expect(filterActivities(items, filter).map((item) => item.id)).toEqual(['1']);
    expect(activityFilterCount(filter)).toBe(3);
    expect(
      filterActivities(items, { ...EMPTY_ACTIVITY_FILTER, entityType: 'comment' }),
    ).toHaveLength(1);
  });
});
