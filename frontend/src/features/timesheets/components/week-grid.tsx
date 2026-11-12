import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { TimesheetRow } from '@/api/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { cellValue, formatCellHours, parseCellHours, rowBillable } from '../timesheet-model';
import { dayLabel, isWeekend } from '../week';

export interface WeekGridProps {
  wsId: string;
  days: string[];
  rows: TimesheetRow[];
  totalsByDay: Record<string, number>;
  total: number;
  editable: boolean;
  busy: boolean;
  onCell: (row: TimesheetRow, day: string, minutes: number) => void;
  onBillable: (row: TimesheetRow, billable: boolean) => void;
}

/** Campo de horas de uma célula; o valor só sai no blur ou no Enter. */
function HourCell({
  minutes,
  label,
  editable,
  busy,
  onCommit,
}: {
  minutes: number;
  label: string;
  editable: boolean;
  busy: boolean;
  onCommit: (minutes: number) => void;
}) {
  const [text, setText] = useState(() => cellValue(minutes));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(cellValue(minutes));
    setInvalid(false);
  }, [minutes]);

  if (!editable) {
    return <span className="text-[13px] text-body">{formatCellHours(minutes)}</span>;
  }

  const commit = (): void => {
    const parsed = parseCellHours(text);

    if (parsed === null) {
      setInvalid(true);

      return;
    }

    setInvalid(false);

    if (parsed !== minutes) {
      onCommit(parsed);
    }
  };

  return (
    <Input
      inputMode="decimal"
      aria-label={label}
      aria-invalid={invalid || undefined}
      disabled={busy}
      value={text}
      className={cn('h-9 w-[56px] px-1 text-center text-[13px] md:h-9', invalid && 'border-danger')}
      onChange={(event) => {
        setText(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        }

        if (event.key === 'Escape') {
          setText(cellValue(minutes));
          setInvalid(false);
        }
      }}
    />
  );
}

function TaskCell({ wsId, row }: { wsId: string; row: TimesheetRow }) {
  return (
    <span className="flex min-w-0 flex-col">
      <Link
        to="/w/$wsId/t/$customId"
        params={{ wsId, customId: row.customId }}
        className="truncate text-[13px] font-medium text-ink hover:text-accent"
      >
        {row.name}
      </Link>
      <span className="text-[11.5px] text-muted">{row.customId}</span>
    </span>
  );
}

/** Grade tarefa × dia da semana, com total por linha e por dia. */
export function WeekGrid({
  wsId,
  days,
  rows,
  totalsByDay,
  total,
  editable,
  busy,
  onCell,
  onBillable,
}: WeekGridProps) {
  return (
    <div className="min-w-0 overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[820px] border-collapse text-[13px]">
        <caption className="sr-only">Horas lançadas por tarefa e por dia da semana</caption>
        <thead>
          <tr className="bg-surface-2 text-left">
            <th scope="col" className="px-3 py-2.5 text-[12px] font-semibold text-muted">
              Tarefa
            </th>
            <th scope="col" className="px-3 py-2.5 text-[12px] font-semibold text-muted">
              Cliente
            </th>
            <th
              scope="col"
              className="px-2 py-2.5 text-center text-[12px] font-semibold text-muted"
            >
              Faturável
            </th>
            {days.map((day) => (
              <th
                key={day}
                scope="col"
                className={cn(
                  'px-1 py-2.5 text-center text-[12px] font-semibold',
                  'text-muted',
                  isWeekend(day) ? 'bg-surface-2/60' : '',
                )}
              >
                {dayLabel(day)}
              </th>
            ))}
            <th scope="col" className="px-3 py-2.5 text-right text-[12px] font-semibold text-muted">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.taskId} className="border-t border-line">
              <td className="max-w-[220px] px-3 py-2">
                <TaskCell wsId={wsId} row={row} />
              </td>
              <td className="max-w-[120px] truncate px-3 py-2 text-body">{row.client || '—'}</td>
              <td className="px-2 py-2 text-center">
                <Checkbox
                  aria-label={`Faturável: ${row.name}`}
                  checked={rowBillable(row)}
                  disabled={!editable || busy || row.total === 0}
                  onCheckedChange={(checked) => {
                    onBillable(row, checked === true);
                  }}
                />
              </td>
              {days.map((day) => (
                <td key={day} className="px-1 py-1.5 text-center">
                  <HourCell
                    minutes={row.minutes[day] ?? 0}
                    label={`Horas em ${dayLabel(day)}: ${row.name}`}
                    editable={editable}
                    busy={busy}
                    onCommit={(minutes) => {
                      onCell(row, day, minutes);
                    }}
                  />
                </td>
              ))}
              <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-ink">
                {formatCellHours(row.total)}
              </td>
            </tr>
          ))}
          <tr className="border-t border-line bg-surface-2">
            <th scope="row" colSpan={3} className="px-3 py-2.5 text-left font-semibold text-ink">
              Total por dia
            </th>
            {days.map((day) => (
              <td key={day} className="px-1 py-2.5 text-center font-semibold text-ink">
                {formatCellHours(totalsByDay[day] ?? 0)}
              </td>
            ))}
            <td
              data-testid="week-total"
              className="whitespace-nowrap px-3 py-2.5 text-right font-bold text-ink"
            >
              {formatCellHours(total)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
