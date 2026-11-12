import { addDays, format, startOfMonth, startOfQuarter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type {
  CardBillable,
  CardBurndown,
  CardBurnup,
  CardCalculator,
  CardConfig,
  CardInput,
  CardTaskList,
  CardTasksByAssignee,
  CardTasksByStatus,
  CardTimeByClient,
  CardTimeByUser,
  CardType,
  DashboardCard,
  WorkloadResult,
} from '@/api/types';
import { toDayKey } from '@/features/views/calendar-model';
import { cardKind } from './card-kinds';

/** Colunas da grade; o mesmo número que o backend aceita em w. */
export const GRID_COLS = 12;
export const ROW_HEIGHT = 72;

/** Recortes de período que o filtro do painel oferece. */
export const RANGE_PRESETS = ['7d', '30d', 'month', 'quarter'] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const RANGE_LABEL: Record<RangePreset, string> = {
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  month: 'Este mês',
  quarter: 'Este trimestre',
};

export interface DateRange {
  from: string;
  to: string;
}

/** Recorte em dias do preset, sempre terminando hoje. */
export function presetRange(preset: RangePreset, today = new Date()): DateRange {
  const to = toDayKey(today);

  if (preset === '7d') {
    return { from: toDayKey(addDays(today, -6)), to };
  }

  if (preset === '30d') {
    return { from: toDayKey(addDays(today, -29)), to };
  }

  return {
    from: toDayKey(preset === 'month' ? startOfMonth(today) : startOfQuarter(today)),
    to,
  };
}

/** Item da grade do react-grid-layout a partir do card salvo. */
export interface GridItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function toLayout(cards: DashboardCard[]): GridItem[] {
  return cards.map((card) => ({ i: card.id, x: card.x, y: card.y, w: card.w, h: card.h }));
}

/** Aplica no array de cards as posições que a grade devolveu. */
export function applyLayout(cards: DashboardCard[], layout: readonly GridItem[]): DashboardCard[] {
  const byId = new Map(layout.map((item) => [item.i, item]));

  return cards.map((card) => {
    const item = byId.get(card.id);

    return item ? { ...card, x: item.x, y: item.y, w: item.w, h: item.h } : card;
  });
}

/** Cards no corpo do PATCH, que substitui a grade inteira. */
export function toCardInputs(cards: DashboardCard[]): CardInput[] {
  return cards.map((card) => ({
    id: card.id,
    type: card.type,
    config: card.config,
    x: card.x,
    y: card.y,
    w: card.w,
    h: card.h,
  }));
}

/** Card novo no fim da grade, com o tamanho padrão do tipo. */
export function appendCard(
  cards: DashboardCard[],
  type: CardType,
  config: CardConfig,
  id: string,
): DashboardCard[] {
  const kind = cardKind(type);
  const y = cards.reduce((bottom, card) => Math.max(bottom, card.y + card.h), 0);

  return [...cards, { id, type, config, x: 0, y, w: kind.size.w, h: kind.size.h }];
}

export function removeCard(cards: DashboardCard[], cardId: string): DashboardCard[] {
  return cards.filter((card) => card.id !== cardId);
}

export function replaceCard(cards: DashboardCard[], card: DashboardCard): DashboardCard[] {
  return cards.map((item) => (item.id === card.id ? card : item));
}

/**
 * Troca o card de lugar com o vizinho na ordem de leitura. É o caminho de
 * teclado e de toque para reordenar: a alça de arrastar só existe no mouse.
 */
export function swapCards(cards: DashboardCard[], cardId: string, delta: 1 | -1): DashboardCard[] {
  const order = singleColumn(cards);
  const index = order.findIndex((card) => card.id === cardId);
  const neighbor = order[index + delta];
  const card = order[index];

  if (!card || !neighbor) {
    return cards;
  }

  const place = (one: DashboardCard, other: DashboardCard): DashboardCard => ({
    ...one,
    x: other.x,
    y: other.y,
    w: other.w,
    h: other.h,
  });

  return cards.map((item) => {
    if (item.id === card.id) {
      return place(item, neighbor);
    }

    return item.id === neighbor.id ? place(item, card) : item;
  });
}

/** Posição do card na ordem de leitura; -1 quando ele não está na grade. */
export function cardIndex(cards: DashboardCard[], cardId: string): number {
  return singleColumn(cards).findIndex((card) => card.id === cardId);
}

/** No celular os cards ficam em uma coluna, na ordem de cima para baixo. */
export function singleColumn(cards: DashboardCard[]): DashboardCard[] {
  return [...cards].sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * Config efetiva do card: o recorte do painel preenche from/to quando o card
 * não tem janela própria, e nunca sobrescreve a que foi salva.
 */
export function effectiveConfig(config: CardConfig, range: DateRange | null): CardConfig {
  if (!range) {
    return config;
  }

  return { ...config, from: config.from ?? range.from, to: config.to ?? range.to };
}

/* Leitura dos dados do card -------------------------------------------- */

export interface Slice {
  name: string;
  value: number;
}

export function statusSlices(data: CardTasksByStatus): Slice[] {
  return data.items.map((item) => ({ name: item.name || 'Sem status', value: item.count }));
}

export function assigneeSlices(data: CardTasksByAssignee): Slice[] {
  return data.items.map((item) => ({ name: item.name || 'Sem responsável', value: item.count }));
}

export function clientSlices(data: CardTimeByClient): Slice[] {
  return data.items.map((item) => ({ name: item.client, value: item.hours }));
}

export function userSlices(data: CardTimeByUser): Slice[] {
  return data.items.map((item) => ({ name: item.name || 'Sem nome', value: item.hours }));
}

export interface SeriesPoint {
  day: string;
  label: string;
  [key: string]: number | string;
}

/** Dia da série com o rótulo curto do eixo. */
function point(day: string): { day: string; label: string } {
  return { day, label: format(new Date(`${day}T12:00:00`), 'd MMM', { locale: ptBR }) };
}

export function burndownSeries(data: CardBurndown): SeriesPoint[] {
  return data.days.map((day, index) => ({
    ...point(day),
    restante: data.remaining[index] ?? 0,
    ideal: data.ideal[index] ?? 0,
  }));
}

export function burnupSeries(data: CardBurnup): SeriesPoint[] {
  return data.days.map((day, index) => ({
    ...point(day),
    escopo: data.scope[index] ?? 0,
    concluido: data.completed[index] ?? 0,
  }));
}

/** Workload por pessoa: uma barra por pessoa com o total do recorte. */
export function workloadSlices(data: WorkloadResult): Slice[] {
  return data.members
    .map((member) => ({ name: member.name, value: member.total }))
    .filter((slice) => slice.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function billableSlices(data: CardBillable): Slice[] {
  return [
    { name: 'Faturável', value: data.billableMinutes },
    { name: 'Não faturável', value: data.nonBillableMinutes },
  ].filter((slice) => slice.value > 0);
}

export function taskRows(data: CardTaskList): CardTaskList['items'] {
  return data.items;
}

export function calculatorValue(data: CardCalculator): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(data.value);
}

/** Horas em pt-BR com uma casa; o card mostra "12,5 h". */
export function formatHoursValue(hours: number): string {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(hours)} h`;
}

export function formatMinutesAsHours(minutes: number): string {
  return formatHoursValue(Math.round((minutes / 60) * 10) / 10);
}
