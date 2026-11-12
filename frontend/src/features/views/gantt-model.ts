import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Task, TaskDependency } from '@/api/types';
import { parseDayKey, toDayKey } from './calendar-model';

export type GanttScale = 'day' | 'week' | 'month';

export const GANTT_SCALES: GanttScale[] = ['day', 'week', 'month'];

export const GANTT_SCALE_LABEL: Record<GanttScale, string> = {
  day: 'Dia',
  week: 'Semana',
  month: 'Mês',
};

/**
 * O eixo é sempre contado em dias; a escala só muda quantos pixels cada dia
 * ocupa e como o cabeçalho agrupa as colunas. Assim o arrasto converte pixels
 * em dias do mesmo jeito nas três escalas.
 */
export const PX_PER_DAY: Record<GanttScale, number> = { day: 36, week: 14, month: 5 };

/** Recorte mínimo de cada escala, para o gráfico nunca nascer apertado. */
const MIN_DAYS: Record<GanttScale, number> = { day: 21, week: 84, month: 365 };

/** Folga antes e depois das barras. */
const PADDING_DAYS: Record<GanttScale, number> = { day: 3, week: 7, month: 15 };

/**
 * Coluna fixa com os nomes: estreita no celular, confortável a partir de 768 px.
 * Só o gráfico rola para os lados, então a coluna precisa caber sempre.
 */
export const NAME_COLUMN_CLASS = 'w-[132px] md:w-[260px]';

export const ROW_HEIGHT = 44;

export const BAR_HEIGHT = 22;

function dayKeysOf(task: Task): { start: string | null; due: string | null } {
  const start = task.startAt ? toDayKey(new Date(task.startAt)) : null;
  const due = task.dueAt ? toDayKey(new Date(task.dueAt)) : null;

  return { start, due };
}

export interface GanttColumn {
  key: string;
  label: string;
  /** Primeiro dia da coluna, em dias desde o início do recorte. */
  offset: number;
  days: number;
  isNow: boolean;
}

export interface GanttRange {
  scale: GanttScale;
  /** Primeiro dia do recorte (yyyy-MM-dd). */
  from: string;
  /** Quantos dias o recorte tem. */
  days: number;
  columns: GanttColumn[];
  /** Largura total do gráfico em pixels. */
  width: number;
  pxPerDay: number;
}

function columnsOf(from: string, days: number, scale: GanttScale, todayKey: string): GanttColumn[] {
  const start = parseDayKey(from);

  if (scale === 'day') {
    return Array.from({ length: days }, (_, offset) => {
      const date = addDays(start, offset);

      return {
        key: toDayKey(date),
        label: format(date, 'd', { locale: ptBR }),
        offset,
        days: 1,
        isNow: toDayKey(date) === todayKey,
      };
    });
  }

  const columns: GanttColumn[] = [];
  let offset = 0;

  while (offset < days) {
    const date = addDays(start, offset);
    const edge =
      scale === 'week'
        ? addDays(startOfWeek(date, { weekStartsOn: 1 }), 7)
        : startOfMonth(addMonths(date, 1));
    const span = Math.min(Math.max(differenceInCalendarDays(edge, date), 1), days - offset);
    const until = addDays(date, span - 1);

    columns.push({
      key: toDayKey(date),
      label:
        scale === 'week'
          ? format(date, 'd MMM', { locale: ptBR })
          : format(date, "MMM 'de' yy", { locale: ptBR }),
      offset,
      days: span,
      isNow: todayKey >= toDayKey(date) && todayKey <= toDayKey(until),
    });

    offset += span;
  }

  return columns;
}

/**
 * Recorte que cobre todas as barras com folga, nunca menor que o mínimo da
 * escala. Sem tarefa com data o recorte nasce em volta de hoje.
 */
export function ganttRange(tasks: Task[], scale: GanttScale, today = new Date()): GanttRange {
  const keys: string[] = [];

  for (const task of tasks) {
    const { start, due } = dayKeysOf(task);

    if (start) {
      keys.push(start);
    }

    if (due) {
      keys.push(due);
    }
  }

  const todayKey = toDayKey(today);
  const sorted = [...keys, todayKey].sort((left, right) => left.localeCompare(right));
  const padding = PADDING_DAYS[scale];
  const firstKey = sorted[0] ?? todayKey;
  const lastKey = sorted[sorted.length - 1] ?? todayKey;
  const start = addDays(parseDayKey(firstKey), -padding);
  const end = addDays(parseDayKey(lastKey), padding);
  const span = Math.max(differenceInCalendarDays(end, start) + 1, MIN_DAYS[scale]);
  const from = toDayKey(start);
  const pxPerDay = PX_PER_DAY[scale];

  return {
    scale,
    from,
    days: span,
    columns: columnsOf(from, span, scale, todayKey),
    width: span * pxPerDay,
    pxPerDay,
  };
}

/** Quantos pixels do início do recorte até o dia pedido. */
export function offsetOfDay(range: GanttRange, day: string): number {
  return differenceInCalendarDays(parseDayKey(day), parseDayKey(range.from)) * range.pxPerDay;
}

/** Dia que cai naquele pixel do gráfico. */
export function dayAtOffset(range: GanttRange, px: number): string {
  const index = Math.max(0, Math.min(range.days - 1, Math.round(px / range.pxPerDay)));

  return toDayKey(addDays(parseDayKey(range.from), index));
}

/** Quantos dias cabem naquele deslocamento em pixels. */
export function daysOfOffset(range: GanttRange, px: number): number {
  return Math.round(px / range.pxPerDay);
}

/** Linha de hoje, no meio da coluna; null quando hoje está fora do recorte. */
export function todayOffset(range: GanttRange, today = new Date()): number | null {
  const index = differenceInCalendarDays(parseDayKey(toDayKey(today)), parseDayKey(range.from));

  return index < 0 || index >= range.days ? null : index * range.pxPerDay + range.pxPerDay / 2;
}

export interface GanttBar {
  left: number;
  width: number;
  /** Início e prazo em dia, já resolvidos (a tarefa pode ter só um dos dois). */
  startDay: string;
  dueDay: string;
  /** Marco vira losango: um dia só, sem barra. */
  milestone: boolean;
}

/**
 * Barra da tarefa. Sem data nenhuma não há barra; com só uma das datas a barra
 * ocupa aquele único dia.
 */
export function barOf(task: Task, range: GanttRange): GanttBar | null {
  const { start, due } = dayKeysOf(task);

  if (!start && !due) {
    return null;
  }

  const startDay = start ?? due ?? range.from;
  const dueDay = due ?? start ?? range.from;
  const first = startDay <= dueDay ? startDay : dueDay;
  const last = startDay <= dueDay ? dueDay : startDay;
  const span = differenceInCalendarDays(parseDayKey(last), parseDayKey(first)) + 1;

  return {
    left: offsetOfDay(range, first),
    width: Math.max(span * range.pxPerDay, range.pxPerDay),
    startDay: first,
    dueDay: last,
    milestone: task.type === 'milestone',
  };
}

/** Mesma hora do dia, dia novo: é o que o arrasto grava. */
export function moveToDay(iso: string | null, day: string, hasTime: boolean): string {
  if (!hasTime || !iso) {
    return parseDayKey(day).toISOString();
  }

  const current = new Date(iso);

  if (Number.isNaN(current.getTime())) {
    return parseDayKey(day).toISOString();
  }

  return new Date(`${day}T${format(current, 'HH:mm')}:00`).toISOString();
}

export function addDaysToKey(day: string, delta: number): string {
  return toDayKey(addDays(parseDayKey(day), delta));
}

export interface GanttArrow {
  /** Tarefa que precisa terminar primeiro. */
  fromId: string;
  /** Tarefa que espera. */
  toId: string;
}

/**
 * Setas do gráfico a partir das dependências. `waiting_on` aponta do que a
 * tarefa aguarda para ela; `blocking` é o contrário. `linked` não vira seta,
 * porque não é relação de ordem.
 */
export function ganttArrows(dependencies: TaskDependency[], visibleIds: string[]): GanttArrow[] {
  const visible = new Set(visibleIds);
  const arrows: GanttArrow[] = [];
  const seen = new Set<string>();

  for (const dependency of dependencies) {
    if (dependency.type === 'linked') {
      continue;
    }

    const fromId = dependency.type === 'waiting_on' ? dependency.dependsOnId : dependency.taskId;
    const toId = dependency.type === 'waiting_on' ? dependency.taskId : dependency.dependsOnId;

    if (!visible.has(fromId) || !visible.has(toId) || fromId === toId) {
      continue;
    }

    const key = `${fromId}>${toId}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    arrows.push({ fromId, toId });
  }

  return arrows;
}
