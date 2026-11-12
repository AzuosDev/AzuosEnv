import { format, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CalendarEvent, PlannerTask } from '@/api/types';
import { parseDayKey, toDayKey, weekdayLabels } from '@/features/views/calendar-model';
import { cn } from '@/lib/utils';
import {
  blockRangeLabel,
  blocksOfDay,
  dueOnDay,
  minutesLabel,
  minutesOfDay,
  monthWeeks,
} from '../planner-model';

export interface PlannerMonthProps {
  anchor: string;
  days: string[];
  events: CalendarEvent[];
  dueTasks: PlannerTask[];
  /** Abrir o dia troca o recorte para "Dia". */
  onOpenDay: (day: string) => void;
}

/** Mês inteiro: cada dia lista o que está marcado e abre no recorte do dia. */
export function PlannerMonth({ anchor, days, events, dueTasks, onOpenDay }: PlannerMonthProps) {
  const month = parseDayKey(anchor);
  const today = toDayKey(new Date());

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-line">
      <div className="grid grid-cols-7 border-b border-line bg-surface-2">
        {weekdayLabels().map((label) => (
          <span key={label} className="p-2 text-center text-[11.5px] font-semibold text-muted">
            {label}
          </span>
        ))}
      </div>

      {monthWeeks(days).map((week) => (
        <div key={week[0]} className="grid grid-cols-7 border-b border-line last:border-b-0">
          {week.map((day) => {
            const blocks = blocksOfDay(events, day);
            const due = dueOnDay(dueTasks, day);
            const inMonth = isSameMonth(parseDayKey(day), month);

            return (
              <button
                key={day}
                type="button"
                onClick={() => {
                  onOpenDay(day);
                }}
                aria-label={`Abrir ${format(parseDayKey(day), "d 'de' MMMM", { locale: ptBR })}`}
                className={cn(
                  'flex min-h-[96px] min-w-0 flex-col items-stretch gap-1 border-l border-line p-1.5 text-left first:border-l-0 hover:bg-surface-2',
                  !inMonth && 'bg-paper-2/60',
                )}
              >
                <span
                  className={cn(
                    'text-[12px] font-semibold',
                    day === today ? 'text-accent' : inMonth ? 'text-body' : 'text-muted',
                  )}
                >
                  {format(parseDayKey(day), 'd', { locale: ptBR })}
                </span>

                {blocks.slice(0, 3).map((block) => (
                  <span
                    key={block.id}
                    title={`${block.title} · ${blockRangeLabel(block, day)}`}
                    className={cn(
                      'truncate rounded-md px-1.5 py-0.5 text-[11px] text-ink',
                      block.kind === 'task' ? 'bg-accent/20' : 'bg-info/[0.16]',
                    )}
                  >
                    {minutesLabel(minutesOfDay(block.start, day))} {block.title}
                  </span>
                ))}

                {blocks.length > 3 ? (
                  <span className="text-[11px] text-muted">
                    +{String(blocks.length - 3)} no dia
                  </span>
                ) : null}

                {due.length > 0 ? (
                  <span className="truncate rounded-md bg-warning/15 px-1.5 py-0.5 text-[11px] text-ink">
                    {due.length === 1 ? '1 prazo' : `${String(due.length)} prazos`}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
