import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '@/api/types';
import {
  DEFAULT_GRID_END,
  DEFAULT_GRID_START,
  HOUR_PX,
  blockGeometry,
  blockOnDay,
  blockRangeLabel,
  blocksOfDay,
  dayDropId,
  dayOfDropId,
  dueOnDay,
  gridHours,
  hourMarks,
  layoutLanes,
  minutesOfDay,
  monthWeeks,
  moveBlock,
  nextFreeSlot,
  nowOffset,
  offsetToIso,
  plannerRange,
  plannerRangeLabel,
  resizeBlock,
  shiftPlanner,
  snapMinutes,
  taskBlockMinutes,
  toBlock,
} from './planner-model';

/** Evento local no fuso de quem usa, que é como a grade enxerga o dia. */
function event(
  id: string,
  day: string,
  start: string,
  end: string,
  taskId?: string,
): CalendarEvent {
  return {
    id,
    workspaceId: 'w1',
    userId: 'u1',
    title: `Evento ${id}`,
    start: new Date(`${day}T${start}:00`).toISOString(),
    end: new Date(`${day}T${end}:00`).toISOString(),
    allDay: false,
    attendeeIds: [],
    taskId: taskId ?? null,
    meetUrl: null,
    recurrence: null,
    source: 'local',
    externalId: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  } as CalendarEvent;
}

describe('plannerRange', () => {
  it('o dia traz um dia só', () => {
    expect(plannerRange('2026-10-28', 'day').days).toEqual(['2026-10-28']);
  });

  it('a semana começa na segunda e tem sete dias', () => {
    const range = plannerRange('2026-10-28', 'week');

    expect(range.days[0]).toBe('2026-10-26');
    expect(range.days).toHaveLength(7);
  });

  it('o mês vem em semanas inteiras', () => {
    const range = plannerRange('2026-10-15', 'month');

    expect(range.days.length % 7).toBe(0);
    expect(range.days[0]).toBe('2026-09-28');
    expect(monthWeeks(range.days)[0]).toHaveLength(7);
  });
});

describe('shiftPlanner e rótulos', () => {
  it('anda por dia, semana e mês', () => {
    expect(shiftPlanner('2026-10-28', 'day', 1)).toBe('2026-10-29');
    expect(shiftPlanner('2026-10-28', 'week', -1)).toBe('2026-10-21');
    expect(shiftPlanner('2026-10-28', 'month', 1)).toBe('2026-11-28');
  });

  it('o rótulo muda com o recorte', () => {
    expect(plannerRangeLabel('2026-10-28', 'month')).toContain('outubro');
    expect(plannerRangeLabel('2026-10-28', 'week')).toContain('–');
  });
});

describe('grade de horas', () => {
  it('sem nada marcado fica na janela padrão', () => {
    expect(gridHours([], ['2026-10-28'])).toEqual({
      startHour: DEFAULT_GRID_START,
      endHour: DEFAULT_GRID_END,
    });
  });

  it('cresce para cobrir o que está fora da janela', () => {
    const hours = gridHours([event('1', '2026-10-28', '06:30', '20:30')], ['2026-10-28']);

    expect(hours).toEqual({ startHour: 6, endHour: 21 });
  });

  it('a régua de horas começa no topo da grade', () => {
    const marks = hourMarks({ startHour: 8, endHour: 10 });

    expect(marks).toHaveLength(2);
    expect(marks[0]).toEqual({ hour: 8, label: '08:00', top: 0 });
    expect(marks[1]?.top).toBe(HOUR_PX);
  });
});

describe('posição do bloco', () => {
  const hours = { startHour: 8, endHour: 18 };

  it('uma hora vale a altura de uma hora', () => {
    const geometry = blockGeometry(
      {
        start: new Date('2026-10-28T09:00:00').toISOString(),
        end: new Date('2026-10-28T10:00:00').toISOString(),
      },
      '2026-10-28',
      hours,
    );

    expect(geometry).toEqual({ top: HOUR_PX, height: HOUR_PX });
  });

  it('o dia recorta o que começou antes', () => {
    expect(minutesOfDay(new Date('2026-10-27T22:00:00').toISOString(), '2026-10-28')).toBe(0);
  });

  it('o bloco que toca o dia aparece nele', () => {
    const blocks = blocksOfDay([event('1', '2026-10-28', '09:00', '10:00')], '2026-10-28');

    expect(blocks).toHaveLength(1);
    expect(blockRangeLabel(blocks[0]!, '2026-10-28')).toBe('09:00 – 10:00');
    expect(toBlock(event('2', '2026-10-28', '09:00', '10:00', 't1')).kind).toBe('task');
  });
});

describe('layoutLanes', () => {
  it('blocos que se cruzam dividem a largura', () => {
    const blocks = blocksOfDay(
      [event('1', '2026-10-28', '09:00', '11:00'), event('2', '2026-10-28', '10:00', '12:00')],
      '2026-10-28',
    );
    const laid = layoutLanes(blocks);

    expect(laid[0]?.lane).toBe(0);
    expect(laid[1]?.lane).toBe(1);
    expect(laid[0]?.lanes).toBe(2);
  });

  it('blocos em sequência ficam na mesma faixa', () => {
    const blocks = blocksOfDay(
      [event('1', '2026-10-28', '09:00', '10:00'), event('2', '2026-10-28', '10:00', '11:00')],
      '2026-10-28',
    );
    const laid = layoutLanes(blocks);

    expect(laid.every((item) => item.lane === 0)).toBe(true);
    expect(laid[0]?.lanes).toBe(1);
  });
});

describe('mover, esticar e encaixar', () => {
  const block = {
    start: new Date('2026-10-28T09:00:00').toISOString(),
    end: new Date('2026-10-28T10:00:00').toISOString(),
  };

  it('todo movimento cai nos quinze minutos', () => {
    expect(snapMinutes(20)).toBe(15);
    expect(snapMinutes(23)).toBe(30);
    expect(snapMinutes(-20)).toBe(-15);
  });

  it('mover mantém a duração', () => {
    const moved = moveBlock(block, 40);

    expect(new Date(moved.start).getHours()).toBe(9);
    expect(new Date(moved.start).getMinutes()).toBe(45);
    expect(new Date(moved.end).getMinutes()).toBe(45);
  });

  it('esticar pelo fim nunca passa do mínimo', () => {
    const shrunk = resizeBlock(block, 'end', -120);

    expect(new Date(shrunk.end).getTime() - new Date(shrunk.start).getTime()).toBe(15 * 60_000);
  });

  it('esticar pelo início anda com o começo', () => {
    const grown = resizeBlock(block, 'start', -60);

    expect(new Date(grown.start).getHours()).toBe(8);
    expect(grown.end).toBe(block.end);
  });

  it('o ponto da grade vira horário encaixado', () => {
    const iso = offsetToIso('2026-10-28', HOUR_PX, { startHour: 8, endHour: 18 });

    expect(new Date(iso).getHours()).toBe(9);
    expect(new Date(iso).getMinutes()).toBe(0);
  });

  it('o bloco muda de dia no mesmo horário', () => {
    const moved = blockOnDay(block, '2026-10-30');

    expect(new Date(moved.start).getDate()).toBe(30);
    expect(new Date(moved.start).getHours()).toBe(9);
  });
});

describe('nextFreeSlot', () => {
  const hours = { startHour: 8, endHour: 18 };

  it('pega o primeiro horário livre depois de agora', () => {
    const slot = nextFreeSlot(
      ['2026-10-28'],
      [event('1', '2026-10-28', '09:00', '10:00')],
      60,
      hours,
      new Date('2026-10-28T08:40:00'),
    );

    expect(slot).not.toBeNull();
    expect(new Date(slot!.start).getHours()).toBe(10);
  });

  it('cai no dia seguinte quando o dia está cheio', () => {
    const slot = nextFreeSlot(
      ['2026-10-28', '2026-10-29'],
      [event('1', '2026-10-28', '08:00', '18:00')],
      60,
      hours,
      new Date('2026-10-28T08:00:00'),
    );

    expect(new Date(slot!.start).getDate()).toBe(29);
  });

  it('sem espaço no recorte devolve null', () => {
    const slot = nextFreeSlot(
      ['2026-10-28'],
      [event('1', '2026-10-28', '08:00', '18:00')],
      60,
      hours,
      new Date('2026-10-28T08:00:00'),
    );

    expect(slot).toBeNull();
  });
});

describe('prazos, agora e droppables', () => {
  it('a estimativa da tarefa define a duração do bloco', () => {
    expect(taskBlockMinutes({ estimateMinutes: 90 })).toBe(90);
    expect(taskBlockMinutes({ estimateMinutes: null })).toBe(60);
    expect(taskBlockMinutes({ estimateMinutes: 5 })).toBe(60);
  });

  it('a linha de agora só existe no dia de hoje', () => {
    const now = new Date('2026-10-28T09:00:00');

    expect(nowOffset('2026-10-28', { startHour: 8, endHour: 18 }, now)).toBe(HOUR_PX);
    expect(nowOffset('2026-10-29', { startHour: 8, endHour: 18 }, now)).toBeNull();
    expect(nowOffset('2026-10-28', { startHour: 10, endHour: 18 }, now)).toBeNull();
  });

  it('o prazo entra no dia dele', () => {
    const tasks = [
      { id: 't1', dueAt: new Date('2026-10-28T15:00:00').toISOString() },
      { id: 't2', dueAt: null },
    ];

    expect(dueOnDay(tasks as never, '2026-10-28')).toHaveLength(1);
  });

  it('o id do droppable volta ao dia', () => {
    expect(dayOfDropId(dayDropId('2026-10-28'))).toBe('2026-10-28');
    expect(dayOfDropId('outro')).toBeNull();
  });
});
