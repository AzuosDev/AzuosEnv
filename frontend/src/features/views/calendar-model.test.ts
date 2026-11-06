import { describe, expect, it } from 'vitest';
import type { Task } from '@/api/types';
import {
  agendaDays,
  calendarRange,
  dayKeyOf,
  dayKeyOfDropId,
  dayDropId,
  dueForDay,
  shiftAnchor,
  tasksByDay,
  tasksWithoutDate,
  weekdayLabels,
} from './calendar-model';

function task(id: string, dueAt: string | null, dueHasTime = false): Task {
  return { id, name: id, dueAt, dueHasTime } as Task;
}

/** Meio-dia local: a mesma hora neutra que o app grava para data sem hora. */
function noon(day: string): string {
  return new Date(`${day}T12:00:00`).toISOString();
}

describe('calendarRange', () => {
  it('no mês abre seis semanas começando na segunda e marca os dias de fora', () => {
    const range = calendarRange('2026-11-18', 'month', new Date('2026-11-18T12:00:00'));

    expect(range.days).toHaveLength(42);
    expect(range.days[0]?.key).toBe('2026-10-26');
    expect(range.days[0]?.inRange).toBe(false);
    expect(range.days.filter((day) => day.inRange)).toHaveLength(30);
    expect(range.days.find((day) => day.isToday)?.key).toBe('2026-11-18');
    expect(range.label).toContain('novembro');
  });

  it('na semana abre sete dias da segunda ao domingo', () => {
    const range = calendarRange('2026-11-18', 'week', new Date('2026-11-18T12:00:00'));

    expect(range.days.map((day) => day.key)).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ]);
    expect(range.from).toBe('2026-11-16');
    expect(range.to).toBe('2026-11-22');
    expect(range.days[5]?.isWeekend).toBe(true);
  });
});

describe('shiftAnchor', () => {
  it('anda de mês no modo mês e de semana no modo semana', () => {
    expect(shiftAnchor('2026-11-18', 'month', 1)).toBe('2026-12-18');
    expect(shiftAnchor('2026-11-18', 'month', -1)).toBe('2026-10-18');
    expect(shiftAnchor('2026-11-18', 'week', 1)).toBe('2026-11-25');
  });
});

describe('tasksByDay', () => {
  it('agrupa pelo dia do prazo e deixa de fora quem não tem data', () => {
    const tasks = [
      task('a', noon('2026-11-18')),
      task('b', noon('2026-11-18')),
      task('c', noon('2026-11-19')),
      task('d', null),
    ];
    const byDay = tasksByDay(tasks);

    expect(byDay.get('2026-11-18')?.map((item) => item.id)).toEqual(['a', 'b']);
    expect(byDay.get('2026-11-19')?.map((item) => item.id)).toEqual(['c']);
    expect(byDay.has('2026-11-20')).toBe(false);
    expect(tasksWithoutDate(tasks).map((item) => item.id)).toEqual(['d']);
  });
});

describe('dueForDay', () => {
  it('sem hora grava meio-dia local do dia novo', () => {
    expect(dueForDay(task('a', noon('2026-11-18')), '2026-11-20')).toBe(noon('2026-11-20'));
  });

  it('com hora mantém a hora da tarefa', () => {
    const original = new Date('2026-11-18T09:30:00').toISOString();
    const moved = dueForDay(task('a', original, true), '2026-11-20');

    expect(new Date(moved).getHours()).toBe(9);
    expect(new Date(moved).getMinutes()).toBe(30);
    expect(dayKeyOf(moved)).toBe('2026-11-20');
  });

  it('tarefa sem prazo cai no meio-dia do dia clicado', () => {
    expect(dueForDay(task('a', null, true), '2026-11-20')).toBe(noon('2026-11-20'));
  });
});

describe('dropId do dia', () => {
  it('ida e volta', () => {
    expect(dayKeyOfDropId(dayDropId('2026-11-18'))).toBe('2026-11-18');
    expect(dayKeyOfDropId('task:1')).toBeNull();
  });
});

describe('agendaDays', () => {
  it('só os dias com tarefa, na ordem do recorte', () => {
    const range = calendarRange('2026-11-18', 'week', new Date('2026-11-18T12:00:00'));
    const byDay = tasksByDay([task('a', noon('2026-11-19')), task('b', noon('2026-11-17'))]);
    const agenda = agendaDays(range, byDay);

    expect(agenda.map((day) => day.key)).toEqual(['2026-11-17', '2026-11-19']);
    expect(agenda[0]?.items.map((item) => item.id)).toEqual(['b']);
  });
});

describe('weekdayLabels', () => {
  it('sete rótulos começando na segunda', () => {
    const labels = weekdayLabels();

    expect(labels).toHaveLength(7);
    expect(labels[0]).toBe('seg');
  });
});
