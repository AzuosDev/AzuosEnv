import type { ApprovalStatus, TimeEntry, TimesheetRow } from '@/api/types';
import type { StatusTone } from '@/components/ui/status-pill';
import { dayKeyOf } from '@/features/views/calendar-model';

/** Hora neutra do lançamento criado pela grade; o meio-dia evita virar o dia. */
export const CELL_TIME = '12:00';

export const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  draft: 'Rascunho · não enviada',
  submitted: 'Enviada · aguardando aprovação',
  approved: 'Aprovada',
  rejected: 'Recusada · ajuste e envie de novo',
};

export const APPROVAL_TONE: Record<ApprovalStatus, StatusTone> = {
  draft: 'neutral',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
};

/** Só rascunho e recusada podem ser editadas e enviadas. */
export function isWeekEditable(status: ApprovalStatus): boolean {
  return status === 'draft' || status === 'rejected';
}

/** Lançamento fechado de uma célula tarefa × dia. */
export interface CellEntry {
  id: string;
  durationMinutes: number;
  billable: boolean;
}

export type CellOp =
  | { kind: 'create'; taskId: string; day: string; minutes: number; billable: boolean }
  | { kind: 'update'; entryId: string; minutes: number }
  | { kind: 'delete'; entryId: string };

/** Chave da célula na tabela de lançamentos da semana. */
export function cellKey(taskId: string, day: string): string {
  return `${taskId}|${day}`;
}

/**
 * Agrupa os lançamentos fechados da semana por tarefa e dia. O cronômetro em
 * andamento (end null) fica fora: ele ainda não tem duração para editar.
 */
export function groupEntries(entries: TimeEntry[]): Map<string, CellEntry[]> {
  const byCell = new Map<string, CellEntry[]>();

  for (const entry of entries) {
    const day = dayKeyOf(entry.start);

    if (!entry.end || !day) {
      continue;
    }

    const key = cellKey(String(entry.taskId), day);
    const cell = byCell.get(key) ?? [];

    cell.push({
      id: entry.id,
      durationMinutes: entry.durationMinutes,
      billable: entry.billable,
    });
    byCell.set(key, cell);
  }

  return byCell;
}

/**
 * Traduz "esta célula agora vale X minutos" em escritas na API: o primeiro
 * lançamento do dia recebe o novo total e os outros saem, para a célula virar
 * um lançamento só. Zero apaga a célula.
 */
export function planCell(
  taskId: string,
  day: string,
  entries: CellEntry[],
  minutes: number,
  billable: boolean,
): CellOp[] {
  if (minutes <= 0) {
    return entries.map((entry) => ({ kind: 'delete', entryId: entry.id }));
  }

  const [first, ...rest] = entries;

  if (!first) {
    return [{ kind: 'create', taskId, day, minutes, billable }];
  }

  const ops: CellOp[] = rest.map((entry) => ({ kind: 'delete', entryId: entry.id }));

  if (first.durationMinutes !== minutes) {
    ops.unshift({ kind: 'update', entryId: first.id, minutes });
  }

  return ops;
}

/** Lançamentos da linha que precisam trocar de faturável. */
export function planBillable(entries: CellEntry[], billable: boolean): string[] {
  return entries.filter((entry) => entry.billable !== billable).map((entry) => entry.id);
}

/** "1,5" vira 90 minutos; texto sem número nenhum devolve null. */
export function parseCellHours(input: string): number | null {
  const text = input.trim().replace(',', '.');

  if (text === '') {
    return 0;
  }

  const hours = Number(text);

  if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
    return null;
  }

  return Math.round(hours * 60);
}

/** 90 minutos vira "1,5" para o campo da célula; zero fica vazio. */
export function cellValue(minutes: number): string {
  if (minutes <= 0) {
    return '';
  }

  return (Math.round((minutes / 60) * 100) / 100).toLocaleString('pt-BR');
}

/** 90 minutos vira "1,5 h"; zero vira travessão. */
export function formatCellHours(minutes: number): string {
  if (minutes <= 0) {
    return '—';
  }

  return `${(Math.round((minutes / 60) * 100) / 100).toLocaleString('pt-BR')} h`;
}

/** Linha vazia de uma tarefa escolhida na mão, para lançar horas nela. */
export function emptyRow(
  taskId: string,
  customId: string,
  name: string,
  days: string[],
): TimesheetRow {
  return {
    taskId,
    customId,
    name,
    listId: '',
    listName: '',
    client: '',
    minutes: Object.fromEntries(days.map((day) => [day, 0])),
    total: 0,
    billableMinutes: 0,
  };
}

/** Grade com as linhas da API mais as tarefas que a pessoa acabou de adicionar. */
export function mergeRows(rows: TimesheetRow[], extras: TimesheetRow[]): TimesheetRow[] {
  const known = new Set(rows.map((row) => row.taskId));

  return [...rows, ...extras.filter((row) => !known.has(row.taskId))];
}

/** Toda a linha é faturável quando todo minuto lançado nela é. */
export function rowBillable(row: TimesheetRow): boolean {
  return row.total > 0 && row.billableMinutes === row.total;
}
