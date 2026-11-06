import { addDays, format, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { WorkloadMetric } from '@/api/types';
import { formatMinutes } from '@/features/tasks/time-fields';
import { parseDayKey, toDayKey } from './calendar-model';

export const WORKLOAD_METRICS: WorkloadMetric[] = ['tasks', 'hours', 'points'];

export const WORKLOAD_METRIC_LABEL: Record<WorkloadMetric, string> = {
  tasks: 'Tarefas',
  hours: 'Horas',
  points: 'Pontos',
};

/** Quantos dias o recorte mostra; o celular rola dentro do container. */
export const WORKLOAD_SPANS = [7, 14] as const;
export type WorkloadSpan = (typeof WORKLOAD_SPANS)[number];

export type CapacityTone = 'empty' | 'free' | 'limit' | 'over';

/**
 * Cor da célula pela capacidade do dia: vazio, abaixo, no limite e acima. Sem
 * capacidade declarada qualquer carga já conta como acima, porque não há teto
 * contra o que comparar.
 */
export function capacityTone(value: number, capacityPerDay: number): CapacityTone {
  if (value <= 0) {
    return 'empty';
  }

  if (capacityPerDay <= 0) {
    return 'over';
  }

  if (value < capacityPerDay) {
    return 'free';
  }

  return value === capacityPerDay ? 'limit' : 'over';
}

export const CAPACITY_CLASS: Record<CapacityTone, string> = {
  empty: 'bg-surface-2 text-muted',
  free: 'bg-success/25 text-ink',
  limit: 'bg-warning/30 text-ink',
  over: 'bg-danger/30 text-ink',
};

export const CAPACITY_LABEL: Record<CapacityTone, string> = {
  empty: 'Sem carga',
  free: 'Livre',
  limit: 'No limite',
  over: 'Acima da capacidade',
};

/** Valor da célula em pt-BR: horas viram 1 h 30 min, o resto vira número. */
export function formatMetricValue(value: number, metric: WorkloadMetric): string {
  if (value === 0) {
    return '';
  }

  if (metric === 'hours') {
    return formatMinutes(Math.round(value * 60));
  }

  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value);
}

export interface WorkloadRange {
  from: string;
  to: string;
  days: { key: string; label: string; isToday: boolean; isWeekend: boolean }[];
}

/** Recorte que começa na segunda da semana do dia âncora. */
export function workloadRange(
  anchor: string,
  span: WorkloadSpan,
  today = new Date(),
): WorkloadRange {
  const start = startOfWeek(parseDayKey(anchor), { weekStartsOn: 1 });
  const todayKey = toDayKey(today);
  const days = Array.from({ length: span }, (_, index) => {
    const date = addDays(start, index);
    const weekday = date.getDay();

    return {
      key: toDayKey(date),
      label: format(date, 'EEEEEE d', { locale: ptBR }),
      isToday: toDayKey(date) === todayKey,
      isWeekend: weekday === 0 || weekday === 6,
    };
  });

  return {
    from: days[0]?.key ?? anchor,
    to: days[days.length - 1]?.key ?? anchor,
    days,
  };
}

export function shiftWorkloadAnchor(anchor: string, span: WorkloadSpan, delta: number): string {
  return toDayKey(addDays(parseDayKey(anchor), span * delta));
}

/** Id do droppable da faixa de uma pessoa no Workload. */
export function personDropId(userId: string): string {
  return `person:${userId}`;
}

export function userIdOfDropId(id: string): string | null {
  return id.startsWith('person:') ? id.slice('person:'.length) : null;
}
