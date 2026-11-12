import { addDaysToKey, dayKeysBetween, weekDayKeys, weekStartOf } from './week';

describe('week', () => {
  it('leva qualquer dia para a segunda-feira da semana', () => {
    expect(weekStartOf('2026-10-28')).toBe('2026-10-26');
    expect(weekStartOf('2026-10-26')).toBe('2026-10-26');
    expect(weekStartOf('2026-11-01')).toBe('2026-10-26');
  });

  it('monta os sete dias da semana', () => {
    expect(weekDayKeys('2026-10-26')).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
  });

  it('atravessa a virada do mês e do ano', () => {
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('lista o intervalo inclusive e recusa datas invertidas', () => {
    expect(dayKeysBetween('2026-10-30', '2026-11-01')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
    expect(() => dayKeysBetween('2026-11-01', '2026-10-30')).toThrow();
  });

  it('recusa data fora do formato', () => {
    expect(() => weekStartOf('30/10/2026')).toThrow();
  });
});
