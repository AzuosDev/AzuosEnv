import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { TimesheetRow } from '@/api/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { StatusPill } from '@/components/ui/status-pill';
import { FormAlert } from '@/features/auth/components/field';
import { TaskSearchPicker } from '@/features/tasks/components/task-search-picker';
import { useMinWidth } from '@/lib/use-min-width';
import { timesheetQuery, weekEntriesQuery } from '../api';
import { useTimesheetActions } from '../hooks/use-timesheet';
import {
  APPROVAL_LABEL,
  APPROVAL_TONE,
  cellKey,
  emptyRow,
  formatCellHours,
  groupEntries,
  isWeekEditable,
  mergeRows,
  rowBillable,
} from '../timesheet-model';
import { weekDayKeys } from '../week';
import { DayGrid } from './day-grid';
import { WeekGrid } from './week-grid';

export interface MyHoursTabProps {
  wsId: string;
  weekStart: string;
  /** Pessoa da grade; ausente é a própria (a aba Equipe passa outra). */
  userId?: string;
  /** Quem não é dono da semana só lê. */
  readOnly?: boolean;
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-1 basis-[136px] flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className="text-[26px] font-semibold leading-tight text-ink">{value}</span>
      {hint ? <span className="text-[12px] text-muted">{hint}</span> : null}
    </div>
  );
}

/** Minhas horas: resumo da semana, envio para aprovação e a grade editável. */
export function MyHoursTab({ wsId, weekStart, userId, readOnly = false }: MyHoursTabProps) {
  const sheet = useQuery(timesheetQuery(wsId, weekStart, userId));
  const entries = useQuery(weekEntriesQuery(wsId, weekStart, userId));
  const actions = useTimesheetActions(wsId, userId);
  const [extras, setExtras] = useState<TimesheetRow[]>([]);
  const wide = useMinWidth(768);
  const days = useMemo(() => weekDayKeys(weekStart), [weekStart]);
  const entriesByCell = useMemo(() => groupEntries(entries.data ?? []), [entries.data]);

  if (sheet.isPending) {
    return <Skeleton className="h-64" />;
  }

  if (sheet.isError) {
    return <FormAlert>{errorMessage(sheet.error)}</FormAlert>;
  }

  const data = sheet.data;
  const rows = mergeRows(data.rows, extras);
  const editable = !readOnly && isWeekEditable(data.approvalStatus);
  const busy = actions.setCell.isPending || actions.setRowBillable.isPending;

  const onCell = (row: TimesheetRow, day: string, minutes: number): void => {
    actions.setCell.mutate({
      taskId: row.taskId,
      day,
      entries: entriesByCell.get(cellKey(row.taskId, day)) ?? [],
      minutes,
      billable: rowBillable(row) || row.total === 0,
    });
  };

  const onBillable = (row: TimesheetRow, billable: boolean): void => {
    actions.setRowBillable.mutate({
      entries: days.flatMap((day) => entriesByCell.get(cellKey(row.taskId, day)) ?? []),
      billable,
    });
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-wrap gap-3">
        <SummaryCard
          label="Total da semana"
          value={formatCellHours(data.totals.total)}
          hint={`${formatCellHours(data.totals.billableMinutes)} faturáveis`}
        />
        <SummaryCard label="Lançamentos" value={String(data.entries)} />
        <div className="flex min-w-0 flex-1 basis-[260px] flex-col items-start gap-2 rounded-2xl border border-line bg-surface p-4">
          <span className="text-[12.5px] text-muted">Situação</span>
          <StatusPill tone={APPROVAL_TONE[data.approvalStatus]}>
            {APPROVAL_LABEL[data.approvalStatus]}
          </StatusPill>
          {readOnly ? null : (
            <Button
              size="sm"
              disabled={
                !isWeekEditable(data.approvalStatus) ||
                data.entries === 0 ||
                actions.submit.isPending
              }
              onClick={() => {
                actions.submit.mutate(weekStart);
              }}
            >
              {actions.submit.isPending ? <Spinner label="Enviando" /> : 'Enviar para aprovação'}
            </Button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Nenhuma hora nesta semana"
          description="Adicione a tarefa em que você trabalhou e lance as horas de cada dia."
        />
      ) : wide ? (
        <WeekGrid
          wsId={wsId}
          days={days}
          rows={rows}
          totalsByDay={data.totals.byDay}
          total={data.totals.total}
          editable={editable}
          busy={busy}
          onCell={onCell}
          onBillable={onBillable}
        />
      ) : (
        <DayGrid
          wsId={wsId}
          days={days}
          rows={rows}
          totalsByDay={data.totals.byDay}
          editable={editable}
          busy={busy}
          onCell={onCell}
          onBillable={onBillable}
        />
      )}

      {editable ? (
        <div className="flex items-center gap-2">
          <TaskSearchPicker
            wsId={wsId}
            label="Buscar tarefa para lançar horas"
            excludeIds={rows.map((row) => row.taskId)}
            onPick={(task) => {
              setExtras((current) => [
                ...current,
                emptyRow(task.id, task.customId, task.name, days),
              ]);
            }}
          >
            <Button variant="ghost" size="sm">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Adicionar linha
            </Button>
          </TaskSearchPicker>
          {busy ? <Spinner label="Salvando" /> : null}
        </div>
      ) : null}
    </div>
  );
}
