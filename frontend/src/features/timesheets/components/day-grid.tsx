import { Link } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { TimesheetRow } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { cellValue, formatCellHours, parseCellHours, rowBillable } from '../timesheet-model';
import { dayLongLabel } from '../week';

export interface DayGridProps {
  wsId: string;
  days: string[];
  rows: TimesheetRow[];
  totalsByDay: Record<string, number>;
  editable: boolean;
  busy: boolean;
  onCell: (row: TimesheetRow, day: string, minutes: number) => void;
  onBillable: (row: TimesheetRow, billable: boolean) => void;
}

function DayRow({
  wsId,
  row,
  day,
  editable,
  busy,
  onCell,
  onBillable,
}: {
  wsId: string;
  row: TimesheetRow;
  day: string;
  editable: boolean;
  busy: boolean;
  onCell: (minutes: number) => void;
  onBillable: (billable: boolean) => void;
}) {
  const minutes = row.minutes[day] ?? 0;
  const [text, setText] = useState(() => cellValue(minutes));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(cellValue(minutes));
    setInvalid(false);
  }, [minutes]);

  const commit = (): void => {
    const parsed = parseCellHours(text);

    if (parsed === null) {
      setInvalid(true);

      return;
    }

    setInvalid(false);

    if (parsed !== minutes) {
      onCell(parsed);
    }
  };

  return (
    <li className="flex flex-col gap-2 border-t border-line px-4 py-3 first:border-t-0">
      <div className="flex min-w-0 flex-col">
        <Link
          to="/w/$wsId/t/$customId"
          params={{ wsId, customId: row.customId }}
          className="truncate text-[13px] font-medium text-ink"
        >
          {row.name}
        </Link>
        <span className="text-[11.5px] text-muted">
          {row.customId}
          {row.client ? ` · ${row.client}` : ''}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {editable ? (
          <Input
            inputMode="decimal"
            aria-label={`Horas em ${dayLongLabel(day)}: ${row.name}`}
            aria-invalid={invalid || undefined}
            disabled={busy}
            value={text}
            className={cn('h-11 w-[96px] text-center', invalid && 'border-danger')}
            onChange={(event) => {
              setText(event.target.value);
            }}
            onBlur={commit}
          />
        ) : (
          <span className="text-[13px] text-body">{formatCellHours(minutes)}</span>
        )}

        <label className="flex min-h-11 items-center gap-2 text-[13px] text-body">
          <Checkbox
            checked={rowBillable(row)}
            disabled={!editable || busy || row.total === 0}
            onCheckedChange={(checked) => {
              onBillable(checked === true);
            }}
          />
          Faturável
        </label>

        <span className="ml-auto text-[12.5px] text-muted">
          Semana: {formatCellHours(row.total)}
        </span>
      </div>
    </li>
  );
}

/** No celular a semana vira um dia por vez, com navegação própria. */
export function DayGrid({
  wsId,
  days,
  rows,
  totalsByDay,
  editable,
  busy,
  onCell,
  onBillable,
}: DayGridProps) {
  const [index, setIndex] = useState(0);
  const day = days[Math.min(index, days.length - 1)] ?? days[0] ?? '';

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center gap-1 rounded-2xl border border-line bg-surface px-2 py-2">
        <Button
          variant="nav"
          size="icon"
          aria-label="Dia anterior"
          disabled={index === 0}
          onClick={() => {
            setIndex((current) => Math.max(0, current - 1));
          }}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <span className="min-w-0 flex-1 text-center text-[13px] font-semibold text-ink">
          {dayLongLabel(day)}
        </span>
        <Button
          variant="nav"
          size="icon"
          aria-label="Próximo dia"
          disabled={index >= days.length - 1}
          onClick={() => {
            setIndex((current) => Math.min(days.length - 1, current + 1));
          }}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <ul className="flex min-w-0 flex-col rounded-2xl border border-line bg-surface">
        {rows.map((row) => (
          <DayRow
            key={row.taskId}
            wsId={wsId}
            row={row}
            day={day}
            editable={editable}
            busy={busy}
            onCell={(minutes) => {
              onCell(row, day, minutes);
            }}
            onBillable={(billable) => {
              onBillable(row, billable);
            }}
          />
        ))}
      </ul>

      <p className="text-[13px] text-muted">
        Total do dia:{' '}
        <strong className="font-semibold text-ink">{formatCellHours(totalsByDay[day] ?? 0)}</strong>
      </p>
    </div>
  );
}
