import { describe, expect, it } from 'vitest';
import type { DashboardCard } from '@/api/types';
import {
  appendCard,
  applyLayout,
  billableSlices,
  burndownSeries,
  effectiveConfig,
  presetRange,
  removeCard,
  replaceCard,
  singleColumn,
  statusSlices,
  swapCards,
  toCardInputs,
  toLayout,
} from './card-model';
import { paletteFrom, seriesColor, tokenRgb } from './chart-palette';

const TODAY = new Date('2026-11-10T12:00:00');

function card(partial: Partial<DashboardCard> & { id: string }): DashboardCard {
  return {
    type: 'tasksByStatus',
    config: {},
    x: 0,
    y: 0,
    w: 6,
    h: 4,
    ...partial,
  };
}

describe('presetRange', () => {
  it('sete e trinta dias terminam hoje', () => {
    expect(presetRange('7d', TODAY)).toEqual({ from: '2026-11-04', to: '2026-11-10' });
    expect(presetRange('30d', TODAY)).toEqual({ from: '2026-10-12', to: '2026-11-10' });
  });

  it('mês e trimestre começam no primeiro dia do período', () => {
    expect(presetRange('month', TODAY)).toEqual({ from: '2026-11-01', to: '2026-11-10' });
    expect(presetRange('quarter', TODAY)).toEqual({ from: '2026-10-01', to: '2026-11-10' });
  });
});

describe('grade dos cards', () => {
  const cards = [card({ id: 'a' }), card({ id: 'b', x: 6, y: 0 })];

  it('vira itens do react-grid-layout e volta com as posições novas', () => {
    expect(toLayout(cards)).toEqual([
      { i: 'a', x: 0, y: 0, w: 6, h: 4 },
      { i: 'b', x: 6, y: 0, w: 6, h: 4 },
    ]);

    const moved = applyLayout(cards, [{ i: 'b', x: 0, y: 4, w: 12, h: 6 }]);

    expect(moved[1]).toMatchObject({ id: 'b', x: 0, y: 4, w: 12, h: 6 });
    expect(moved[0]).toMatchObject({ id: 'a', x: 0, y: 0 });
  });

  it('o card novo entra abaixo do último', () => {
    const next = appendCard(cards, 'billable', { location: 'everything' }, 'c');

    expect(next).toHaveLength(3);
    expect(next[2]).toMatchObject({ id: 'c', type: 'billable', x: 0, y: 4, w: 4, h: 3 });
  });

  it('remove, substitui e ordena em uma coluna', () => {
    expect(removeCard(cards, 'a').map((item) => item.id)).toEqual(['b']);
    expect(replaceCard(cards, card({ id: 'b', w: 12 }))[1]?.w).toBe(12);
    expect(
      singleColumn([card({ id: 'x', y: 4 }), card({ id: 'y', y: 0 })]).map((item) => item.id),
    ).toEqual(['y', 'x']);
  });

  it('trocar de lugar leva a geometria do vizinho', () => {
    const swapped = swapCards(cards, 'b', -1);

    expect(swapped.find((item) => item.id === 'b')).toMatchObject({ x: 0, y: 0 });
    expect(swapped.find((item) => item.id === 'a')).toMatchObject({ x: 6, y: 0 });
    expect(swapCards(cards, 'a', -1)).toEqual(cards);
  });

  it('o corpo do PATCH leva id, tipo, config e posição', () => {
    expect(toCardInputs([card({ id: 'a' })])).toEqual([
      { id: 'a', type: 'tasksByStatus', config: {}, x: 0, y: 0, w: 6, h: 4 },
    ]);
  });
});

describe('effectiveConfig', () => {
  const range = { from: '2026-11-01', to: '2026-11-10' };

  it('o recorte do painel preenche o que falta', () => {
    expect(effectiveConfig({}, range)).toEqual(range);
  });

  it('a janela salva no card vence a do painel', () => {
    expect(effectiveConfig({ from: '2026-01-01' }, range)).toEqual({
      from: '2026-01-01',
      to: '2026-11-10',
    });
  });

  it('sem recorte a config não muda', () => {
    expect(effectiveConfig({ metric: 'hours' }, null)).toEqual({ metric: 'hours' });
  });
});

describe('leitura dos dados', () => {
  it('status sem nome vira "Sem status"', () => {
    expect(
      statusSlices({
        items: [{ statusId: '1', name: '', group: null, position: 0, count: 3 }],
        total: 3,
      }),
    ).toEqual([{ name: 'Sem status', value: 3 }]);
  });

  it('burndown casa dia, restante e ideal', () => {
    expect(
      burndownSeries({
        days: ['2026-11-09', '2026-11-10'],
        total: 4,
        remaining: [4, 2],
        ideal: [4, 0],
      }),
    ).toEqual([
      { day: '2026-11-09', label: '9 nov', restante: 4, ideal: 4 },
      { day: '2026-11-10', label: '10 nov', restante: 2, ideal: 0 },
    ]);
  });

  it('faturável esconde a fatia zerada', () => {
    expect(
      billableSlices({
        totalMinutes: 60,
        billableMinutes: 60,
        nonBillableMinutes: 0,
        billableHours: 1,
        totalHours: 1,
        billablePercent: 100,
      }),
    ).toEqual([{ name: 'Faturável', value: 60 }]);
  });
});

describe('paleta dos gráficos', () => {
  it('o triplet do token vira rgb() e o inválido cai no padrão', () => {
    expect(tokenRgb(' 167 139 250 ')).toBe('rgb(167 139 250)');
    expect(tokenRgb('var(--accent)')).toBe('rgb(128 128 128)');
  });

  it('a paleta sai dos tokens e a série recomeça no fim', () => {
    const palette = paletteFrom((token) => (token === '--accent' ? '1 2 3' : '4 5 6'));

    expect(palette.series[0]).toBe('rgb(1 2 3)');
    expect(seriesColor(palette, 0)).toBe('rgb(1 2 3)');
    expect(seriesColor(palette, palette.series.length)).toBe('rgb(1 2 3)');
  });
});
