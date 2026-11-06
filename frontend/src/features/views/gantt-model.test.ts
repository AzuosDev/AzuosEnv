import { describe, expect, it } from 'vitest';
import type { Task, TaskDependency } from '@/api/types';
import {
  PX_PER_DAY,
  addDaysToKey,
  barOf,
  dayAtOffset,
  daysOfOffset,
  ganttArrows,
  ganttRange,
  moveToDay,
  offsetOfDay,
  todayOffset,
} from './gantt-model';

const TODAY = new Date('2026-11-18T12:00:00');

function noon(day: string): string {
  return new Date(`${day}T12:00:00`).toISOString();
}

function task(id: string, startAt: string | null, dueAt: string | null, type = 'task'): Task {
  return { id, name: id, startAt, dueAt, dueHasTime: false, type } as Task;
}

function dependency(taskId: string, dependsOnId: string, type: string): TaskDependency {
  return { id: `${taskId}-${dependsOnId}`, taskId, dependsOnId, type } as TaskDependency;
}

describe('ganttRange', () => {
  it('cobre as barras com folga e nunca fica menor que o mínimo da escala', () => {
    const range = ganttRange([task('a', noon('2026-11-10'), noon('2026-11-14'))], 'day', TODAY);

    expect(range.from).toBe('2026-11-07');
    expect(range.days).toBeGreaterThanOrEqual(21);
    expect(range.width).toBe(range.days * PX_PER_DAY.day);
    expect(range.columns).toHaveLength(range.days);
  });

  it('sem tarefa com data nasce em volta de hoje', () => {
    const range = ganttRange([task('a', null, null)], 'day', TODAY);

    expect(range.from).toBe('2026-11-15');
    expect(range.columns.find((column) => column.isNow)?.key).toBe('2026-11-18');
  });

  it('na escala semana cada coluna é uma semana e começa na segunda', () => {
    const range = ganttRange([task('a', noon('2026-11-10'), noon('2026-11-14'))], 'week', TODAY);
    const second = range.columns[1];

    expect(range.pxPerDay).toBe(PX_PER_DAY.week);
    expect(second?.days).toBe(7);
    expect(new Date(`${second?.key ?? ''}T12:00:00`).getDay()).toBe(1);
  });

  it('na escala mês cada coluna é um mês', () => {
    const range = ganttRange([task('a', noon('2026-11-10'), noon('2026-11-14'))], 'month', TODAY);

    expect(range.columns.length).toBeGreaterThan(1);
    expect(range.columns[1]?.key.endsWith('-01')).toBe(true);
  });
});

describe('barOf', () => {
  it('posiciona e dimensiona pelo recorte', () => {
    const range = ganttRange([task('a', noon('2026-11-10'), noon('2026-11-14'))], 'day', TODAY);
    const bar = barOf(task('a', noon('2026-11-10'), noon('2026-11-14')), range);

    expect(bar?.left).toBe(offsetOfDay(range, '2026-11-10'));
    expect(bar?.width).toBe(5 * PX_PER_DAY.day);
    expect(bar?.startDay).toBe('2026-11-10');
    expect(bar?.dueDay).toBe('2026-11-14');
  });

  it('com só uma das datas ocupa um dia e sem data nenhuma não tem barra', () => {
    const range = ganttRange([task('a', null, noon('2026-11-12'))], 'day', TODAY);

    expect(barOf(task('a', null, noon('2026-11-12')), range)?.width).toBe(PX_PER_DAY.day);
    expect(barOf(task('b', null, null), range)).toBeNull();
  });

  it('datas invertidas viram barra do menor para o maior', () => {
    const range = ganttRange([task('a', noon('2026-11-14'), noon('2026-11-10'))], 'day', TODAY);
    const bar = barOf(task('a', noon('2026-11-14'), noon('2026-11-10')), range);

    expect(bar?.startDay).toBe('2026-11-10');
    expect(bar?.dueDay).toBe('2026-11-14');
  });

  it('marco é marcado como losango', () => {
    const range = ganttRange([], 'day', TODAY);

    expect(barOf(task('a', null, noon('2026-11-18'), 'milestone'), range)?.milestone).toBe(true);
  });
});

describe('eixo em pixels', () => {
  it('converte pixel em dia e dia em pixel na mesma conta', () => {
    const range = ganttRange([], 'week', TODAY);

    expect(dayAtOffset(range, offsetOfDay(range, range.from))).toBe(range.from);
    expect(daysOfOffset(range, PX_PER_DAY.week * 3)).toBe(3);
    expect(dayAtOffset(range, -500)).toBe(range.from);
  });

  it('a linha de hoje só existe dentro do recorte', () => {
    const range = ganttRange([], 'day', TODAY);

    expect(todayOffset(range, TODAY)).toBeGreaterThan(0);
    expect(todayOffset(range, new Date('2030-01-01T12:00:00'))).toBeNull();
  });
});

describe('moveToDay', () => {
  it('sem hora grava meio-dia e com hora mantém a hora', () => {
    expect(moveToDay(noon('2026-11-10'), '2026-11-12', false)).toBe(noon('2026-11-12'));

    const moved = moveToDay(new Date('2026-11-10T08:15:00').toISOString(), '2026-11-12', true);

    expect(new Date(moved).getHours()).toBe(8);
    expect(new Date(moved).getMinutes()).toBe(15);
  });

  it('addDaysToKey anda em dias de calendário', () => {
    expect(addDaysToKey('2026-11-30', 1)).toBe('2026-12-01');
  });
});

describe('ganttArrows', () => {
  it('waiting_on aponta do que trava para quem espera e blocking é o contrário', () => {
    const arrows = ganttArrows(
      [dependency('a', 'b', 'waiting_on'), dependency('c', 'd', 'blocking')],
      ['a', 'b', 'c', 'd'],
    );

    expect(arrows).toEqual([
      { fromId: 'b', toId: 'a' },
      { fromId: 'c', toId: 'd' },
    ]);
  });

  it('ignora linked, repetida e tarefa fora da tela', () => {
    const arrows = ganttArrows(
      [
        dependency('a', 'b', 'linked'),
        dependency('a', 'b', 'waiting_on'),
        dependency('a', 'b', 'waiting_on'),
        dependency('a', 'z', 'waiting_on'),
      ],
      ['a', 'b'],
    );

    expect(arrows).toEqual([{ fromId: 'b', toId: 'a' }]);
  });
});
