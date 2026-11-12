import { describe, expect, it } from 'vitest';
import {
  durationInput,
  elapsedSeconds,
  formatMinutes,
  formatStopwatch,
  parseDuration,
} from './time-fields';

describe('formatMinutes', () => {
  it('escreve horas e minutos em português', () => {
    expect(formatMinutes(0)).toBe('0min');
    expect(formatMinutes(null)).toBe('0min');
    expect(formatMinutes(45)).toBe('45min');
    expect(formatMinutes(60)).toBe('1h');
    expect(formatMinutes(150)).toBe('2h 30min');
  });
});

describe('formatStopwatch', () => {
  it('mostra a hora só quando passa de uma', () => {
    expect(formatStopwatch(0)).toBe('00:00');
    expect(formatStopwatch(65)).toBe('01:05');
    expect(formatStopwatch(3725)).toBe('1:02:05');
    expect(formatStopwatch(-10)).toBe('00:00');
  });
});

describe('elapsedSeconds', () => {
  it('conta do início até agora e nunca fica negativo', () => {
    const start = '2026-11-05T10:00:00.000Z';

    expect(elapsedSeconds(start, Date.parse('2026-11-05T10:02:30.000Z'))).toBe(150);
    expect(elapsedSeconds(start, Date.parse('2026-11-05T09:59:00.000Z'))).toBe(0);
    expect(elapsedSeconds('nada', Date.now())).toBe(0);
  });
});

describe('parseDuration', () => {
  it('aceita as formas que a pessoa digita', () => {
    expect(parseDuration('90')).toBe(90);
    expect(parseDuration('90min')).toBe(90);
    expect(parseDuration('1h30')).toBe(90);
    expect(parseDuration('1h 30min')).toBe(90);
    expect(parseDuration('1:30')).toBe(90);
    expect(parseDuration('1,5h')).toBe(90);
    expect(parseDuration('2h')).toBe(120);
  });

  it('campo vazio zera e texto sem número é recusado', () => {
    expect(parseDuration('')).toBe(0);
    expect(parseDuration('   ')).toBe(0);
    expect(parseDuration('duas horas')).toBeNull();
    expect(parseDuration('h')).toBeNull();
  });
});

describe('durationInput', () => {
  it('volta dos minutos para o texto do campo', () => {
    expect(durationInput(0)).toBe('');
    expect(durationInput(null)).toBe('');
    expect(durationInput(90)).toBe('1h30min');
    expect(durationInput(45)).toBe('45min');
  });
});
