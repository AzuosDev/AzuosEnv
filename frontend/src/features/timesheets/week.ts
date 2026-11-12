import { addDays, format, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseDayKey, toDayKey } from '@/features/views/calendar-model';

/** A semana do app começa na segunda, como no backend. */
export const WEEK_START = 1;

export const WEEK_DAYS = 7;

/** Segunda-feira da semana de qualquer dia (YYYY-MM-DD). */
export function weekStartKey(anchor: string): string {
  return toDayKey(startOfWeek(parseDayKey(anchor), { weekStartsOn: WEEK_START }));
}

export function currentWeekStart(today = new Date()): string {
  return weekStartKey(toDayKey(today));
}

export function shiftWeek(weekStart: string, delta: number): string {
  return toDayKey(addDays(parseDayKey(weekStart), delta * WEEK_DAYS));
}

/** Os sete dias da semana, de segunda a domingo. */
export function weekDayKeys(weekStart: string): string[] {
  const start = parseDayKey(weekStart);

  return Array.from({ length: WEEK_DAYS }, (_, index) => toDayKey(addDays(start, index)));
}

/** "26 out – 1 nov 2026": o ano aparece uma vez, no fim. */
export function weekRangeLabel(weekStart: string): string {
  const days = weekDayKeys(weekStart);
  const first = parseDayKey(days[0] ?? weekStart);
  const last = parseDayKey(days[days.length - 1] ?? weekStart);
  const sameMonth = first.getMonth() === last.getMonth();

  return `${format(first, sameMonth ? 'd' : 'd MMM', { locale: ptBR })} – ${format(
    last,
    "d MMM 'de' yyyy",
    { locale: ptBR },
  )}`;
}

/** "Seg 26" para o cabeçalho da coluna. */
export function dayLabel(key: string): string {
  return format(parseDayKey(key), 'EEEEEE d', { locale: ptBR });
}

/** "Segunda, 26 de outubro" para o aria-label e para o celular. */
export function dayLongLabel(key: string): string {
  return format(parseDayKey(key), "EEEE, d 'de' MMMM", { locale: ptBR });
}

export function isWeekend(key: string): boolean {
  const weekday = parseDayKey(key).getDay();

  return weekday === 0 || weekday === 6;
}

/** Recorte da semana em ISO UTC, para GET /time/entries. */
export function weekRangeIso(weekStart: string): { from: string; to: string } {
  const start = new Date(`${weekStart}T00:00:00`);

  return {
    from: start.toISOString(),
    to: addDays(start, WEEK_DAYS).toISOString(),
  };
}
