import {
  addDays,
  addMonths,
  addWeeks,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Task } from '@/api/types';
import { DAY_ONLY_TIME } from '@/features/tasks/task-fields';

export type CalendarMode = 'month' | 'week';

export const CALENDAR_MODES: CalendarMode[] = ['month', 'week'];

export const CALENDAR_MODE_LABEL: Record<CalendarMode, string> = {
  month: 'Mês',
  week: 'Semana',
};

/** A semana começa na segunda, como o resto do app. */
const WEEK_START = 1;

/** Seis linhas de sete dias cobrem qualquer mês sem a grade mudar de altura. */
const MONTH_DAYS = 42;

/** Dia no formato yyyy-MM-dd, no fuso do navegador. */
export function toDayKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** Meio-dia local do dia: a hora neutra que o app usa para data sem hora. */
export function parseDayKey(key: string): Date {
  return new Date(`${key}T${DAY_ONLY_TIME}:00`);
}

/** Dia do instante, no fuso do navegador; null quando não há data. */
export function dayKeyOf(iso: string | null | undefined): string | null {
  if (!iso) {
    return null;
  }

  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? null : toDayKey(date);
}

export interface CalendarDay {
  key: string;
  /** Número do dia no mês. */
  number: number;
  /** Mês abreviado, mostrado quando o dia é de outro mês. */
  month: string;
  /** Falso nos dias que entram só para fechar a grade do mês. */
  inRange: boolean;
  isToday: boolean;
  isWeekend: boolean;
}

export interface CalendarRange {
  mode: CalendarMode;
  /** Dia que ancora o recorte (yyyy-MM-dd). */
  anchor: string;
  days: CalendarDay[];
  /** Primeiro e último dia do recorte, para o filtro da consulta. */
  from: string;
  to: string;
  label: string;
}

/** Grade do mês (6×7) ou da semana (1×7) a partir do dia âncora. */
export function calendarRange(
  anchor: string,
  mode: CalendarMode,
  today = new Date(),
): CalendarRange {
  const base = parseDayKey(anchor);
  const start =
    mode === 'month'
      ? startOfWeek(startOfMonth(base), { weekStartsOn: WEEK_START })
      : startOfWeek(base, { weekStartsOn: WEEK_START });
  const count = mode === 'month' ? MONTH_DAYS : 7;
  const todayKey = toDayKey(today);
  const days: CalendarDay[] = [];

  for (let index = 0; index < count; index += 1) {
    const date = addDays(start, index);
    const weekday = date.getDay();

    days.push({
      key: toDayKey(date),
      number: date.getDate(),
      month: format(date, 'MMM', { locale: ptBR }),
      inRange: mode === 'week' || isSameMonth(date, base),
      isToday: toDayKey(date) === todayKey,
      isWeekend: weekday === 0 || weekday === 6,
    });
  }

  const first = days[0]?.key ?? anchor;
  const last = days[days.length - 1]?.key ?? anchor;

  return {
    mode,
    anchor,
    days,
    from: first,
    to: last,
    label:
      mode === 'month'
        ? format(base, "MMMM 'de' yyyy", { locale: ptBR })
        : `${format(parseDayKey(first), 'd MMM', { locale: ptBR })} – ${format(parseDayKey(last), "d MMM 'de' yyyy", { locale: ptBR })}`,
  };
}

/** Avança ou volta um mês (ou uma semana) a partir do dia âncora. */
export function shiftAnchor(anchor: string, mode: CalendarMode, delta: number): string {
  const base = parseDayKey(anchor);

  return toDayKey(mode === 'month' ? addMonths(base, delta) : addWeeks(base, delta));
}

/** Tarefas por dia do prazo; as sem prazo ficam de fora. */
export function tasksByDay(tasks: Task[]): Map<string, Task[]> {
  const byDay = new Map<string, Task[]>();

  for (const task of tasks) {
    const key = dayKeyOf(task.dueAt);

    if (!key) {
      continue;
    }

    byDay.set(key, [...(byDay.get(key) ?? []), task]);
  }

  return byDay;
}

export function tasksWithoutDate(tasks: Task[]): Task[] {
  return tasks.filter((task) => task.dueAt === null);
}

/**
 * Prazo da tarefa jogado para outro dia. A hora é preservada quando a tarefa usa
 * hora; sem hora o app grava meio-dia local, como no painel.
 */
export function dueForDay(task: Pick<Task, 'dueAt' | 'dueHasTime'>, day: string): string {
  if (!task.dueHasTime || !task.dueAt) {
    return parseDayKey(day).toISOString();
  }

  const current = new Date(task.dueAt);

  if (Number.isNaN(current.getTime())) {
    return parseDayKey(day).toISOString();
  }

  return new Date(`${day}T${format(current, 'HH:mm')}:00`).toISOString();
}

/** Cabeçalho da grade: seg, ter, qua… */
export function weekdayLabels(): string[] {
  const start = startOfWeek(new Date(), { weekStartsOn: WEEK_START });

  return Array.from({ length: 7 }, (_, index) =>
    format(addDays(start, index), 'EEEEEE', { locale: ptBR }),
  );
}

/** Id do droppable de um dia da grade. */
export function dayDropId(key: string): string {
  return `day:${key}`;
}

export function dayKeyOfDropId(id: string): string | null {
  return id.startsWith('day:') ? id.slice('day:'.length) : null;
}

export interface AgendaDay {
  key: string;
  label: string;
  isToday: boolean;
  items: Task[];
}

/** Agenda do celular: um bloco por dia com tarefa, na ordem do recorte. */
export function agendaDays(range: CalendarRange, byDay: Map<string, Task[]>): AgendaDay[] {
  return range.days
    .filter((day) => (byDay.get(day.key) ?? []).length > 0)
    .map((day) => ({
      key: day.key,
      label: format(parseDayKey(day.key), "EEEE, d 'de' MMMM", { locale: ptBR }),
      isToday: day.isToday,
      items: byDay.get(day.key) ?? [],
    }));
}
