import { describe, expect, it } from 'vitest';
import type { TimeEntry, TimesheetRow } from '@/api/types';
import {
  cellKey,
  cellValue,
  emptyRow,
  formatCellHours,
  groupEntries,
  isWeekEditable,
  mergeRows,
  parseCellHours,
  planBillable,
  planCell,
  rowBillable,
} from './timesheet-model';

function entry(partial: Partial<TimeEntry> & { id: string }): TimeEntry {
  return {
    createdAt: '2026-10-26T12:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
    workspaceId: 'ws',
    userId: 'me',
    taskId: 't1',
    start: '2026-10-26T12:00:00.000Z',
    end: '2026-10-26T14:00:00.000Z',
    durationMinutes: 120,
    billable: true,
    note: '',
    source: 'manual',
    approvalStatus: 'draft',
    approvedBy: null,
    ...partial,
  } as TimeEntry;
}

function row(partial: Partial<TimesheetRow>): TimesheetRow {
  return { ...emptyRow('t1', 'AZD-1', 'Tarefa', ['2026-10-26']), ...partial };
}

describe('isWeekEditable', () => {
  it('rascunho e recusada podem mudar; enviada e aprovada não', () => {
    expect(isWeekEditable('draft')).toBe(true);
    expect(isWeekEditable('rejected')).toBe(true);
    expect(isWeekEditable('submitted')).toBe(false);
    expect(isWeekEditable('approved')).toBe(false);
  });
});

describe('groupEntries', () => {
  it('agrupa por tarefa e dia e deixa o cronômetro em andamento fora', () => {
    const grouped = groupEntries([
      entry({ id: 'a' }),
      entry({ id: 'b', durationMinutes: 30 }),
      entry({ id: 'c', taskId: 't2', start: '2026-10-27T12:00:00.000Z' }),
      entry({ id: 'd', end: null, durationMinutes: 0 }),
    ]);

    expect(grouped.get(cellKey('t1', '2026-10-26'))?.map((cell) => cell.id)).toEqual(['a', 'b']);
    expect(grouped.get(cellKey('t2', '2026-10-27'))?.map((cell) => cell.id)).toEqual(['c']);
    expect([...grouped.values()].flat().some((cell) => cell.id === 'd')).toBe(false);
  });
});

describe('planCell', () => {
  const existing = [
    { id: 'a', durationMinutes: 120, billable: true },
    { id: 'b', durationMinutes: 30, billable: true },
  ];

  it('célula vazia cria um lançamento', () => {
    expect(planCell('t1', '2026-10-26', [], 90, false)).toEqual([
      { kind: 'create', taskId: 't1', day: '2026-10-26', minutes: 90, billable: false },
    ]);
  });

  it('zero apaga tudo que havia no dia', () => {
    expect(planCell('t1', '2026-10-26', existing, 0, true)).toEqual([
      { kind: 'delete', entryId: 'a' },
      { kind: 'delete', entryId: 'b' },
    ]);
  });

  it('o primeiro lançamento recebe o total e os outros saem', () => {
    expect(planCell('t1', '2026-10-26', existing, 90, true)).toEqual([
      { kind: 'update', entryId: 'a', minutes: 90 },
      { kind: 'delete', entryId: 'b' },
    ]);
  });

  it('total igual ao que já estava não gera escrita', () => {
    expect(planCell('t1', '2026-10-26', [existing[0]!], 120, true)).toEqual([]);
  });
});

describe('planBillable', () => {
  it('só os lançamentos que discordam do novo valor entram', () => {
    const ids = planBillable(
      [
        { id: 'a', durationMinutes: 60, billable: true },
        { id: 'b', durationMinutes: 60, billable: false },
      ],
      false,
    );

    expect(ids).toEqual(['a']);
  });
});

describe('parseCellHours', () => {
  it('aceita vírgula, ponto e campo vazio', () => {
    expect(parseCellHours('1,5')).toBe(90);
    expect(parseCellHours('2.25')).toBe(135);
    expect(parseCellHours('')).toBe(0);
    expect(parseCellHours('0')).toBe(0);
  });

  it('recusa texto, negativo e mais de 24 horas', () => {
    expect(parseCellHours('abc')).toBeNull();
    expect(parseCellHours('-1')).toBeNull();
    expect(parseCellHours('25')).toBeNull();
  });
});

describe('cellValue e formatCellHours', () => {
  it('minutos viram horas em pt-BR', () => {
    expect(cellValue(90)).toBe('1,5');
    expect(cellValue(0)).toBe('');
    expect(formatCellHours(90)).toBe('1,5 h');
    expect(formatCellHours(0)).toBe('—');
  });
});

describe('mergeRows e rowBillable', () => {
  it('a tarefa adicionada na mão não duplica a linha que já veio da API', () => {
    const merged = mergeRows(
      [row({ taskId: 't1' })],
      [row({ taskId: 't1' }), row({ taskId: 't2' })],
    );

    expect(merged.map((item) => item.taskId)).toEqual(['t1', 't2']);
  });

  it('a linha é faturável quando todo minuto dela é', () => {
    expect(rowBillable(row({ total: 120, billableMinutes: 120 }))).toBe(true);
    expect(rowBillable(row({ total: 120, billableMinutes: 60 }))).toBe(false);
    expect(rowBillable(row({ total: 0, billableMinutes: 0 }))).toBe(false);
  });
});
