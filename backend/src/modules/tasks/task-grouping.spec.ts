import { Types } from 'mongoose';
import { TaskDocument } from './schemas/task.schema';
import { compareByKey, dayWindow, dueBucket, isAfterCursor, sortKeyOf } from './task-grouping';
import { TaskPriority } from './task-fields';

const TIMEZONE = 'America/Fortaleza';
const NOW = new Date('2026-03-10T12:00:00.000Z');

function task(overrides: Partial<TaskDocument> = {}): TaskDocument {
  return {
    _id: new Types.ObjectId(),
    name: 'Tarefa',
    position: 'a0',
    dueAt: null,
    priority: null,
    get: () => undefined,
    ...overrides,
  } as unknown as TaskDocument;
}

describe('dueBucket', () => {
  const window = dayWindow(NOW, TIMEZONE);

  it.each([
    ['2026-03-09T23:00:00.000Z', 'overdue'],
    ['2026-03-10T05:00:00.000Z', 'today'],
    ['2026-03-11T15:00:00.000Z', 'next7'],
    ['2026-03-17T15:00:00.000Z', 'next7'],
    ['2026-03-18T15:00:00.000Z', 'later'],
  ])('classifica %s como %s', (dueAt, expected) => {
    expect(dueBucket(new Date(dueAt), window)).toBe(expected);
  });

  it('sem data vai para noDate', () => {
    expect(dueBucket(null, window)).toBe('noDate');
  });
});

describe('sortKeyOf', () => {
  it('ordena prioridade de urgent a sem prioridade', () => {
    const keys = (['urgent', 'high', 'normal', 'low', null] as (TaskPriority | null)[]).map(
      (priority) => sortKeyOf(task({ priority }), 'priority'),
    );

    expect([...keys].sort()).toEqual(keys);
  });

  it('coloca tarefas sem data de entrega no fim', () => {
    const withDue = sortKeyOf(task({ dueAt: new Date('2099-12-31T00:00:00.000Z') }), 'dueAt');
    const withoutDue = sortKeyOf(task(), 'dueAt');

    expect(withDue < withoutDue).toBe(true);
  });

  it('usa a posição manual por padrão', () => {
    expect(sortKeyOf(task({ position: 'a1' }), 'position')).toBe('a1');
  });
});

describe('compareByKey', () => {
  it('desempata pelo id para o cursor não repetir tarefas', () => {
    const first = { key: 'a', id: '1' };
    const second = { key: 'a', id: '2' };

    expect(compareByKey(first, second)).toBeLessThan(0);
    expect(isAfterCursor(second, first)).toBe(true);
    expect(isAfterCursor(first, first)).toBe(false);
  });
});
