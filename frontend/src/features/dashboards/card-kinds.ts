import {
  BarChart3,
  CalendarClock,
  Calculator,
  Clock,
  Coins,
  LineChart,
  PieChart,
  Table,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { CardType } from '@/api/types';

/** Campos de config que cada tipo de card usa; o diálogo mostra só esses. */
export type CardField = 'location' | 'range' | 'metric' | 'calculator' | 'limit' | 'closed';

export interface CardKind {
  type: CardType;
  label: string;
  description: string;
  icon: LucideIcon;
  fields: CardField[];
  /** Tamanho inicial na grade de 12 colunas. */
  size: { w: number; h: number };
  /** O recorte de período é obrigatório para o card responder. */
  needsRange?: boolean;
}

export const CARD_KINDS: CardKind[] = [
  {
    type: 'tasksByStatus',
    label: 'Tarefas por status',
    description: 'Quantas tarefas estão em cada status do local.',
    icon: PieChart,
    fields: ['location', 'closed'],
    size: { w: 6, h: 4 },
  },
  {
    type: 'tasksByAssignee',
    label: 'Tarefas por responsável',
    description: 'Carga aberta de cada pessoa no local.',
    icon: Users,
    fields: ['location', 'closed'],
    size: { w: 6, h: 4 },
  },
  {
    type: 'workload',
    label: 'Workload',
    description: 'Tarefas, horas ou pontos por pessoa e por dia.',
    icon: BarChart3,
    fields: ['location', 'range', 'metric'],
    size: { w: 12, h: 5 },
    needsRange: true,
  },
  {
    type: 'burndown',
    label: 'Burndown',
    description: 'O que falta fechar, dia a dia, contra a linha ideal.',
    icon: LineChart,
    fields: ['location', 'range'],
    size: { w: 6, h: 5 },
    needsRange: true,
  },
  {
    type: 'burnup',
    label: 'Burnup',
    description: 'Escopo e concluído acumulados no período.',
    icon: TrendingUp,
    fields: ['location', 'range'],
    size: { w: 6, h: 5 },
    needsRange: true,
  },
  {
    type: 'timeByClient',
    label: 'Tempo por cliente',
    description: 'Horas lançadas somadas por cliente da List.',
    icon: Clock,
    fields: ['location', 'range'],
    size: { w: 6, h: 4 },
  },
  {
    type: 'timeByUser',
    label: 'Tempo por pessoa',
    description: 'Horas lançadas somadas por pessoa.',
    icon: Clock,
    fields: ['location', 'range'],
    size: { w: 6, h: 4 },
  },
  {
    type: 'billable',
    label: 'Faturável',
    description: 'Quanto do tempo do período é faturável.',
    icon: Coins,
    fields: ['location', 'range'],
    size: { w: 4, h: 3 },
  },
  {
    type: 'overdueList',
    label: 'Atrasadas',
    description: 'Tarefas abertas que passaram do prazo.',
    icon: CalendarClock,
    fields: ['location', 'limit'],
    size: { w: 6, h: 5 },
  },
  {
    type: 'taskTable',
    label: 'Tabela de tarefas',
    description: 'Lista de tarefas do local com status e prazo.',
    icon: Table,
    fields: ['location', 'limit', 'closed'],
    size: { w: 12, h: 5 },
  },
  {
    type: 'calculator',
    label: 'Calculadora',
    description: 'Soma ou média de um campo numérico das tarefas.',
    icon: Calculator,
    fields: ['location', 'calculator', 'closed'],
    size: { w: 4, h: 3 },
  },
];

export function cardKind(type: CardType): CardKind {
  return CARD_KINDS.find((kind) => kind.type === type) ?? CARD_KINDS[0]!;
}

export function cardLabel(type: CardType): string {
  return cardKind(type).label;
}
