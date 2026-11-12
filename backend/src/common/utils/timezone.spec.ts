import { startOfZonedDay, zonedDateKey } from './timezone';

describe('startOfZonedDay', () => {
  it('resolve a meia-noite do fuso de Fortaleza (UTC-3)', () => {
    const date = new Date('2026-03-10T05:30:00.000Z');

    expect(startOfZonedDay(date, 'America/Fortaleza').toISOString()).toBe(
      '2026-03-10T03:00:00.000Z',
    );
  });

  it('usa o dia local, não o dia UTC', () => {
    const date = new Date('2026-03-10T02:00:00.000Z');

    expect(startOfZonedDay(date, 'America/Fortaleza').toISOString()).toBe(
      '2026-03-09T03:00:00.000Z',
    );
  });

  it('soma dias no fuso local', () => {
    const date = new Date('2026-03-10T05:30:00.000Z');

    expect(startOfZonedDay(date, 'America/Fortaleza', 1).toISOString()).toBe(
      '2026-03-11T03:00:00.000Z',
    );
  });

  it('atravessa o horário de verão de Berlim', () => {
    const date = new Date('2026-03-29T10:00:00.000Z');

    expect(startOfZonedDay(date, 'Europe/Berlin').toISOString()).toBe('2026-03-28T23:00:00.000Z');
    expect(startOfZonedDay(date, 'Europe/Berlin', 1).toISOString()).toBe(
      '2026-03-29T22:00:00.000Z',
    );
  });
});

describe('zonedDateKey', () => {
  it('formata a data no fuso informado', () => {
    expect(zonedDateKey(new Date('2026-03-10T02:00:00.000Z'), 'America/Fortaleza')).toBe(
      '2026-03-09',
    );
    expect(zonedDateKey(new Date('2026-03-10T02:00:00.000Z'), 'UTC')).toBe('2026-03-10');
  });
});
