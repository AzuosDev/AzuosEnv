import { Types } from 'mongoose';
import { isClosedGroup, recordChange, sameValue, toDate } from './task-diff';
import { TaskChanges } from './task-events';

describe('isClosedGroup', () => {
  it('considera done e closed como fechados', () => {
    expect(isClosedGroup('done')).toBe(true);
    expect(isClosedGroup('closed')).toBe(true);
    expect(isClosedGroup('active')).toBe(false);
    expect(isClosedGroup('notStarted')).toBe(false);
  });
});

describe('sameValue', () => {
  it('compara ObjectId e Date pelo valor', () => {
    const id = new Types.ObjectId();

    expect(sameValue(id, new Types.ObjectId(String(id)))).toBe(true);
    expect(
      sameValue(new Date('2026-01-01T00:00:00.000Z'), new Date('2026-01-01T00:00:00.000Z')),
    ).toBe(true);
    expect(sameValue([id], [id, id])).toBe(false);
  });

  it('trata null e undefined como o mesmo valor', () => {
    expect(sameValue(null, undefined)).toBe(true);
  });
});

describe('recordChange', () => {
  it('registra apenas o que mudou, com from e to normalizados', () => {
    const changes: TaskChanges = {};
    const id = new Types.ObjectId();

    expect(recordChange(changes, 'priority', 'low', 'low')).toBe(false);
    expect(recordChange(changes, 'priority', 'low', 'urgent')).toBe(true);
    expect(recordChange(changes, 'assigneeIds', [], [id])).toBe(true);

    expect(changes).toEqual({
      priority: { from: 'low', to: 'urgent' },
      assigneeIds: { from: [], to: [String(id)] },
    });
  });
});

describe('toDate', () => {
  it('converte ISO e trata vazio como null', () => {
    expect(toDate('2026-01-01T00:00:00.000Z')?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(toDate(null)).toBeNull();
    expect(toDate(undefined)).toBeNull();
  });
});
