import { describe, expect, it } from 'vitest';
import {
  currentWeekStart,
  dayLabel,
  isWeekend,
  shiftWeek,
  weekDayKeys,
  weekRangeLabel,
  weekStartKey,
} from './week';

describe('weekStartKey', () => {
  it('qualquer dia cai na segunda da semana', () => {
    expect(weekStartKey('2026-10-28')).toBe('2026-10-26');
    expect(weekStartKey('2026-10-26')).toBe('2026-10-26');
    expect(weekStartKey('2026-11-01')).toBe('2026-10-26');
  });

  it('hoje também cai na segunda', () => {
    expect(currentWeekStart(new Date('2026-10-29T12:00:00'))).toBe('2026-10-26');
  });
});

describe('weekDayKeys e shiftWeek', () => {
  it('sete dias de segunda a domingo', () => {
    const days = weekDayKeys('2026-10-26');

    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-10-26');
    expect(days[6]).toBe('2026-11-01');
  });

  it('navega sete dias por vez', () => {
    expect(shiftWeek('2026-10-26', 1)).toBe('2026-11-02');
    expect(shiftWeek('2026-10-26', -1)).toBe('2026-10-19');
  });
});

describe('rótulos da semana', () => {
  it('o intervalo traz o mês só quando ele muda', () => {
    expect(weekRangeLabel('2026-10-26')).toBe('26 out – 1 nov de 2026');
    expect(weekRangeLabel('2026-11-02')).toBe('2 – 8 nov de 2026');
  });

  it('a coluna mostra o dia da semana abreviado', () => {
    expect(dayLabel('2026-10-26')).toBe('seg 26');
  });

  it('sábado e domingo são fim de semana', () => {
    expect(isWeekend('2026-10-31')).toBe(true);
    expect(isWeekend('2026-11-01')).toBe(true);
    expect(isWeekend('2026-10-30')).toBe(false);
  });
});
