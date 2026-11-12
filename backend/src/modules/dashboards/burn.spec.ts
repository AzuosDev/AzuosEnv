import { burndownSeries, burnupSeries, idealSeries } from './burn';

const DAYS = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29'];

describe('burn', () => {
  it('desconta as tarefas fechadas em cada dia', () => {
    expect(burndownSeries(DAYS, 8, { '2026-10-27': 2, '2026-10-29': 3 })).toEqual([8, 6, 6, 3]);
  });

  it('parte do que já estava fechado antes do recorte', () => {
    expect(burndownSeries(DAYS, 8, { '2026-10-28': 1 }, 2)).toEqual([6, 6, 5, 5]);
  });

  it('nunca fica negativo', () => {
    expect(burndownSeries(DAYS, 1, { '2026-10-26': 3 })).toEqual([0, 0, 0, 0]);
  });

  it('traça a linha ideal até zero', () => {
    expect(idealSeries(DAYS, 9)).toEqual([9, 6, 3, 0]);
    expect(idealSeries(['2026-10-26'], 5)).toEqual([0]);
  });

  it('acumula escopo e entregas no burnup', () => {
    expect(burnupSeries(DAYS, { '2026-10-26': 4, '2026-10-28': 2 }, { '2026-10-27': 1 })).toEqual({
      scope: [4, 4, 6, 6],
      completed: [0, 1, 1, 1],
    });
  });
});
