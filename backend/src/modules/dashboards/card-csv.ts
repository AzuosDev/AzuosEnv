import { CsvCell } from '../../common/utils/csv';
import { toHours } from '../time/time-fields';
import { CardType } from './dashboard-cards';
import { CardData } from './card-data.service';

export interface CardTable {
  columns: string[];
  rows: CsvCell[][];
}

interface CountItem {
  name: string;
  count: number;
}

interface MinutesItem {
  name?: string;
  client?: string;
  minutes: number;
  billableMinutes: number;
}

interface TaskItem {
  customId: string;
  name: string;
  status: string;
  priority: string | null;
  assignees: string[];
  dueAt: string | null;
  points: number | null;
  estimateMinutes: number | null;
  trackedMinutes: number;
}

interface WorkloadMemberItem {
  name: string;
  capacityPerDay: number;
  total: number;
  byDay: Record<string, number>;
}

/** Turns the data of a card into the table the CSV export writes. */
export function cardTable(type: CardType, data: CardData): CardTable {
  if (type === 'tasksByStatus' || type === 'tasksByAssignee') {
    const items = (data.items ?? []) as CountItem[];

    return {
      columns: [type === 'tasksByStatus' ? 'Status' : 'Responsável', 'Tarefas'],
      rows: items.map((item) => [item.name, item.count]),
    };
  }

  if (type === 'timeByClient' || type === 'timeByUser') {
    const items = (data.items ?? []) as MinutesItem[];

    return {
      columns: [
        type === 'timeByClient' ? 'Cliente' : 'Pessoa',
        'Horas',
        'Horas faturáveis',
        'Minutos',
      ],
      rows: items.map((item) => [
        item.client ?? item.name ?? '',
        toHours(item.minutes),
        toHours(item.billableMinutes),
        item.minutes,
      ]),
    };
  }

  if (type === 'overdueList' || type === 'taskTable') {
    const items = (data.items ?? []) as TaskItem[];

    return {
      columns: [
        'ID',
        'Tarefa',
        'Status',
        'Prioridade',
        'Responsáveis',
        'Prazo',
        'Pontos',
        'Estimativa (min)',
        'Tempo (min)',
      ],
      rows: items.map((item) => [
        item.customId,
        item.name,
        item.status,
        item.priority ?? '',
        item.assignees.join(', '),
        item.dueAt ?? '',
        item.points,
        item.estimateMinutes,
        item.trackedMinutes,
      ]),
    };
  }

  if (type === 'workload') {
    const days = (data.days ?? []) as string[];
    const members = (data.members ?? []) as WorkloadMemberItem[];

    return {
      columns: ['Pessoa', 'Capacidade/dia', ...days, 'Total'],
      rows: members.map((member) => [
        member.name,
        member.capacityPerDay,
        ...days.map((day) => member.byDay[day] ?? 0),
        member.total,
      ]),
    };
  }

  if (type === 'burndown') {
    const days = (data.days ?? []) as string[];
    const remaining = (data.remaining ?? []) as number[];
    const ideal = (data.ideal ?? []) as number[];

    return {
      columns: ['Dia', 'Restante', 'Ideal'],
      rows: days.map((day, index) => [day, remaining[index] ?? 0, ideal[index] ?? 0]),
    };
  }

  if (type === 'burnup') {
    const days = (data.days ?? []) as string[];
    const scope = (data.scope ?? []) as number[];
    const completed = (data.completed ?? []) as number[];

    return {
      columns: ['Dia', 'Escopo', 'Concluído'],
      rows: days.map((day, index) => [day, scope[index] ?? 0, completed[index] ?? 0]),
    };
  }

  if (type === 'billable') {
    return {
      columns: ['Horas faturáveis', 'Horas não faturáveis', 'Horas totais', '% faturável'],
      rows: [
        [
          toHours(Number(data.billableMinutes ?? 0)),
          toHours(Number(data.nonBillableMinutes ?? 0)),
          toHours(Number(data.totalMinutes ?? 0)),
          Number(data.billablePercent ?? 0),
        ],
      ],
    };
  }

  return {
    columns: ['Operação', 'Campo', 'Itens', 'Valor'],
    rows: [
      [
        String(data.op ?? ''),
        String(data.field ?? ''),
        Number(data.count ?? 0),
        Number(data.value ?? 0),
      ],
    ],
  };
}
