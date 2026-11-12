import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CalendarEvent, PlannerTask } from '@/api/types';
import { parseDayKey, toDayKey } from '@/features/views/calendar-model';
import { WEEK_START, weekDayKeys, weekStartKey } from '@/features/timesheets/week';

/** Recortes do Planner. O celular só mostra o dia. */
export type PlannerMode = 'day' | 'week' | 'month';

export const PLANNER_MODES: PlannerMode[] = ['day', 'week', 'month'];

export const PLANNER_MODE_LABEL: Record<PlannerMode, string> = {
  day: 'Dia',
  week: 'Semana',
  month: 'Mês',
};

/** Altura de uma hora na grade, como no protótipo. */
export const HOUR_PX = 56;

/** Todo arrasto cai de quinze em quinze minutos. */
export const SNAP_MINUTES = 15;

export const MIN_BLOCK_MINUTES = 15;

export const MINUTES_IN_DAY = 1440;

/** Janela que a grade sempre mostra, mesmo sem nada marcado. */
export const DEFAULT_GRID_START = 8;
export const DEFAULT_GRID_END = 18;

/** Duração de um bloco criado a partir de tarefa sem estimativa. */
export const DEFAULT_BLOCK_MINUTES = 60;

export interface PlannerRange {
  /** Começo do período em UTC ISO, como o GET /me/planner pede. */
  from: string;
  to: string;
  /** Dias do recorte em YYYY-MM-DD, na ordem da tela. */
  days: string[];
}

export interface PlannerBlock {
  id: string;
  title: string;
  start: string;
  end: string;
  taskId: string | null;
  /** Bloco de tarefa ou evento da agenda; muda a cor e o que o painel oferece. */
  kind: 'task' | 'event';
  /** Evento vindo de fora (Google) não pode ser arrastado. */
  external: boolean;
}

export interface BlockGeometry {
  top: number;
  height: number;
}

export interface LaidOutBlock {
  block: PlannerBlock;
  lane: number;
  lanes: number;
}

export interface HourMark {
  hour: number;
  label: string;
  top: number;
}

export interface GridHours {
  startHour: number;
  endHour: number;
}

export function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Meia-noite local do dia. O parseDayKey do Calendário devolve meio-dia (a hora
 * neutra da data sem hora), e a grade do Planner precisa do começo do dia.
 */
export function dayStart(key: string): Date {
  return new Date(`${key}T00:00:00`);
}

/** "09:30" a partir dos minutos desde a meia-noite. */
export function minutesLabel(minutes: number): string {
  const clamped = Math.max(0, Math.min(MINUTES_IN_DAY, Math.round(minutes)));

  return `${pad2(Math.floor(clamped / 60))}:${pad2(clamped % 60)}`;
}

/** Dias do recorte e o intervalo em UTC que a API recebe. */
export function plannerRange(anchor: string, mode: PlannerMode): PlannerRange {
  const days = daysOfMode(anchor, mode);
  const first = dayStart(days[0] ?? anchor);
  const last = dayStart(days[days.length - 1] ?? anchor);

  return {
    from: first.toISOString(),
    to: addDays(last, 1).toISOString(),
    days,
  };
}

function daysOfMode(anchor: string, mode: PlannerMode): string[] {
  if (mode === 'day') {
    return [anchor];
  }

  if (mode === 'week') {
    return weekDayKeys(weekStartKey(anchor));
  }

  const date = parseDayKey(anchor);
  const first = startOfWeek(startOfMonth(date), { weekStartsOn: WEEK_START });
  const last = endOfWeek(endOfMonth(date), { weekStartsOn: WEEK_START });
  const days: string[] = [];

  for (let cursor = first; cursor <= last; cursor = addDays(cursor, 1)) {
    days.push(toDayKey(cursor));
  }

  return days;
}

export function shiftPlanner(anchor: string, mode: PlannerMode, delta: number): string {
  const date = parseDayKey(anchor);

  if (mode === 'day') {
    return toDayKey(addDays(date, delta));
  }

  if (mode === 'week') {
    return toDayKey(addDays(date, delta * 7));
  }

  return toDayKey(addMonths(date, delta));
}

/** "Qua, 28 de outubro", "26 out – 1 nov de 2026" ou "outubro de 2026". */
export function plannerRangeLabel(anchor: string, mode: PlannerMode): string {
  const days = daysOfMode(anchor, mode);

  if (mode === 'day') {
    return format(parseDayKey(anchor), "EEEE, d 'de' MMMM", { locale: ptBR });
  }

  if (mode === 'month') {
    return format(parseDayKey(anchor), "MMMM 'de' yyyy", { locale: ptBR });
  }

  const first = parseDayKey(days[0] ?? anchor);
  const last = parseDayKey(days[days.length - 1] ?? anchor);
  const sameMonth = first.getMonth() === last.getMonth();

  return `${format(first, sameMonth ? 'd' : 'd MMM', { locale: ptBR })} – ${format(
    last,
    "d MMM 'de' yyyy",
    { locale: ptBR },
  )}`;
}

/** Minutos desde a meia-noite local do dia, recortados no próprio dia. */
export function minutesOfDay(iso: string, dayKey: string): number {
  const start = dayStart(dayKey).getTime();
  const minutes = (new Date(iso).getTime() - start) / 60_000;

  return Math.max(0, Math.min(MINUTES_IN_DAY, minutes));
}

/** Verdadeiro quando o evento toca o dia, mesmo que comece antes. */
export function touchesDay(event: Pick<PlannerBlock, 'start' | 'end'>, dayKey: string): boolean {
  const from = dayStart(dayKey).getTime();
  const to = from + MINUTES_IN_DAY * 60_000;
  const start = new Date(event.start).getTime();
  const end = new Date(event.end).getTime();

  return start < to && end > from;
}

export function toBlock(event: CalendarEvent): PlannerBlock {
  return {
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    taskId: event.taskId ?? null,
    kind: event.taskId ? 'task' : 'event',
    external: event.source !== 'local',
  };
}

/** Blocos que aparecem no dia, do mais cedo para o mais tarde. */
export function blocksOfDay(events: CalendarEvent[], dayKey: string): PlannerBlock[] {
  return events
    .map(toBlock)
    .filter((block) => touchesDay(block, dayKey))
    .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
}

/** A grade cobre a janela padrão mais tudo que já está marcado. */
export function gridHours(events: CalendarEvent[], days: string[]): GridHours {
  let startHour = DEFAULT_GRID_START;
  let endHour = DEFAULT_GRID_END;

  for (const day of days) {
    for (const block of blocksOfDay(events, day)) {
      startHour = Math.min(startHour, Math.floor(minutesOfDay(block.start, day) / 60));
      endHour = Math.max(endHour, Math.ceil(minutesOfDay(block.end, day) / 60));
    }
  }

  return {
    startHour: Math.max(0, startHour),
    endHour: Math.min(24, Math.max(endHour, startHour + 1)),
  };
}

export function gridHeight(hours: GridHours): number {
  return (hours.endHour - hours.startHour) * HOUR_PX;
}

export function blockGeometry(
  block: Pick<PlannerBlock, 'start' | 'end'>,
  dayKey: string,
  hours: GridHours,
): BlockGeometry {
  const start = minutesOfDay(block.start, dayKey);
  const end = Math.max(start + MIN_BLOCK_MINUTES, minutesOfDay(block.end, dayKey));
  const offset = hours.startHour * 60;

  return {
    top: ((start - offset) / 60) * HOUR_PX,
    height: ((end - start) / 60) * HOUR_PX,
  };
}

/**
 * Reparte os blocos que se cruzam em faixas lado a lado. A primeira faixa livre
 * recebe o bloco, então dois blocos só dividem a largura quando se sobrepõem.
 */
export function layoutLanes(blocks: PlannerBlock[]): LaidOutBlock[] {
  const laneEnds: number[] = [];
  const placed = blocks.map((block) => {
    const start = new Date(block.start).getTime();
    const end = new Date(block.end).getTime();
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);

    if (lane === -1) {
      lane = laneEnds.length;
    }

    laneEnds[lane] = end;

    return { block, lane };
  });

  return placed.map((item) => ({ ...item, lanes: laneEnds.length || 1 }));
}

export function snapMinutes(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

/** Instante de um ponto da grade, já encaixado nos quinze minutos. */
export function offsetToIso(dayKey: string, offsetPx: number, hours: GridHours): string {
  const minutes = snapMinutes(hours.startHour * 60 + (offsetPx / HOUR_PX) * 60);
  const clamped = Math.max(0, Math.min(MINUTES_IN_DAY - MIN_BLOCK_MINUTES, minutes));

  return new Date(dayStart(dayKey).getTime() + clamped * 60_000).toISOString();
}

export function addMinutesIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

export function durationMinutes(block: Pick<PlannerBlock, 'start' | 'end'>): number {
  return Math.round((new Date(block.end).getTime() - new Date(block.start).getTime()) / 60_000);
}

/** Move o bloco inteiro, mantendo a duração. */
export function moveBlock(
  block: Pick<PlannerBlock, 'start' | 'end'>,
  deltaMinutes: number,
): { start: string; end: string } {
  const minutes = snapMinutes(deltaMinutes);

  return {
    start: addMinutesIso(block.start, minutes),
    end: addMinutesIso(block.end, minutes),
  };
}

/** Estica o bloco por uma das pontas, nunca abaixo do mínimo. */
export function resizeBlock(
  block: Pick<PlannerBlock, 'start' | 'end'>,
  edge: 'start' | 'end',
  deltaMinutes: number,
): { start: string; end: string } {
  const minutes = snapMinutes(deltaMinutes);
  const total = durationMinutes(block);

  if (edge === 'end') {
    const next = Math.max(MIN_BLOCK_MINUTES, total + minutes);

    return { start: block.start, end: addMinutesIso(block.start, next) };
  }

  const next = Math.max(MIN_BLOCK_MINUTES, total - minutes);

  return { start: addMinutesIso(block.end, -next), end: block.end };
}

/** Bloco colocado em outro dia, no mesmo horário. */
export function blockOnDay(
  block: Pick<PlannerBlock, 'start' | 'end'>,
  dayKey: string,
): { start: string; end: string } {
  const current = toDayKey(new Date(block.start));
  const delta = dayStart(dayKey).getTime() - dayStart(current).getTime();

  return {
    start: new Date(new Date(block.start).getTime() + delta).toISOString(),
    end: new Date(new Date(block.end).getTime() + delta).toISOString(),
  };
}

export function taskBlockMinutes(task: Pick<PlannerTask, 'estimateMinutes'>): number {
  const estimate = task.estimateMinutes ?? 0;

  return estimate >= MIN_BLOCK_MINUTES ? snapMinutes(estimate) : DEFAULT_BLOCK_MINUTES;
}

/**
 * Primeiro horário livre do recorte a partir de agora, que é o que o botão
 * "Agendar" reserva — no celular não existe arrastar.
 */
export function nextFreeSlot(
  days: string[],
  events: CalendarEvent[],
  minutes: number,
  hours: GridHours,
  now = new Date(),
): { start: string; end: string } | null {
  const duration = Math.max(MIN_BLOCK_MINUTES, snapMinutes(minutes));

  for (const day of days) {
    const taken = blocksOfDay(events, day).map((block) => ({
      start: minutesOfDay(block.start, day),
      end: minutesOfDay(block.end, day),
    }));
    const from = dayStart(day).getTime();
    const floor =
      from <= now.getTime() && now.getTime() < from + MINUTES_IN_DAY * 60_000
        ? snapMinutes((now.getTime() - from) / 60_000)
        : 0;

    for (
      let start = Math.max(hours.startHour * 60, floor);
      start + duration <= hours.endHour * 60;
      start += SNAP_MINUTES
    ) {
      const free = !taken.some((slot) => start < slot.end && slot.start < start + duration);

      if (free) {
        return {
          start: new Date(from + start * 60_000).toISOString(),
          end: new Date(from + (start + duration) * 60_000).toISOString(),
        };
      }
    }
  }

  return null;
}

export function hourMarks(hours: GridHours): HourMark[] {
  const marks: HourMark[] = [];

  for (let hour = hours.startHour; hour < hours.endHour; hour += 1) {
    marks.push({
      hour,
      label: `${pad2(hour)}:00`,
      top: (hour - hours.startHour) * HOUR_PX,
    });
  }

  return marks;
}

/** Posição da linha de agora no dia, ou null quando ela não cabe na grade. */
export function nowOffset(dayKey: string, hours: GridHours, now = new Date()): number | null {
  if (toDayKey(now) !== dayKey) {
    return null;
  }

  const minutes = now.getHours() * 60 + now.getMinutes();

  if (minutes < hours.startHour * 60 || minutes > hours.endHour * 60) {
    return null;
  }

  return ((minutes - hours.startHour * 60) / 60) * HOUR_PX;
}

/** "09:00 – 10:30" do bloco, no dia em que ele está desenhado. */
export function blockRangeLabel(
  block: Pick<PlannerBlock, 'start' | 'end'>,
  dayKey: string,
): string {
  return `${minutesLabel(minutesOfDay(block.start, dayKey))} – ${minutesLabel(
    minutesOfDay(block.end, dayKey),
  )}`;
}

/** Quebra os dias do mês em semanas de sete. */
export function monthWeeks(days: string[]): string[][] {
  const weeks: string[][] = [];

  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return weeks;
}

/** Tarefas com prazo no dia, para a faixa de prazos da coluna. */
export function dueOnDay(tasks: PlannerTask[], dayKey: string): PlannerTask[] {
  return tasks.filter((task) => task.dueAt && toDayKey(new Date(task.dueAt)) === dayKey);
}

export const DAY_DROP_PREFIX = 'planner-day:';

export function dayDropId(dayKey: string): string {
  return `${DAY_DROP_PREFIX}${dayKey}`;
}

export function dayOfDropId(id: string): string | null {
  return id.startsWith(DAY_DROP_PREFIX) ? id.slice(DAY_DROP_PREFIX.length) : null;
}
