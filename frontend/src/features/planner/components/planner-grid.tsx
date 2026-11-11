import { useDroppable } from '@dnd-kit/core';
import { Link } from '@tanstack/react-router';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { CalendarEvent, PlannerTask } from '@/api/types';
import { parseDayKey, toDayKey } from '@/features/views/calendar-model';
import { cn } from '@/lib/utils';
import {
  HOUR_PX,
  blockGeometry,
  blockRangeLabel,
  blocksOfDay,
  dayDropId,
  dueOnDay,
  gridHeight,
  hourMarks,
  layoutLanes,
  moveBlock,
  nowOffset,
  resizeBlock,
  type GridHours,
  type PlannerBlock,
} from '../planner-model';

/** O que o ponteiro está mudando no bloco. */
type DragKind = 'move' | 'start' | 'end';

interface DragState {
  id: string;
  kind: DragKind;
  origin: number;
  minutes: number;
}

export interface PlannerGridProps {
  wsId: string;
  days: string[];
  hours: GridHours;
  events: CalendarEvent[];
  dueTasks: PlannerTask[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCommit: (eventId: string, slot: { start: string; end: string }) => void;
  /** Abaixo de 1024 o bloco não se arrasta: o toque só seleciona. */
  canDrag: boolean;
}

/** Minutos que um passo de teclado move ou estica. */
const KEY_STEP = 15;

/** Largura da coluna das horas, igual nas duas grades. */
const GUTTER_PX = 56;

function minutesOfPixels(delta: number): number {
  return (delta / HOUR_PX) * 60;
}

function templateColumns(count: number): string {
  return `${String(GUTTER_PX)}px repeat(${String(count)}, minmax(0, 1fr))`;
}

function DayHead({
  wsId,
  day,
  dueTasks,
  single,
}: {
  wsId: string;
  day: string;
  dueTasks: PlannerTask[];
  single: boolean;
}) {
  const due = dueOnDay(dueTasks, day);
  const today = toDayKey(new Date()) === day;

  return (
    <div className="flex min-w-0 flex-col gap-1.5 border-l border-line p-2">
      <span
        className={cn(
          'text-center text-[12.5px] font-semibold',
          today ? 'text-accent' : 'text-muted',
        )}
      >
        {single
          ? format(parseDayKey(day), "EEEE, d 'de' MMMM", { locale: ptBR })
          : format(parseDayKey(day), 'EEEEEE d', { locale: ptBR })}
      </span>

      {due.length > 0 ? (
        <ul
          aria-label={`Prazos de ${format(parseDayKey(day), 'd/MM', { locale: ptBR })}`}
          className="flex min-w-0 flex-col gap-1"
        >
          {due.map((task) => (
            <li key={task.id} className="min-w-0">
              <Link
                to="/w/$wsId/t/$customId"
                params={{ wsId, customId: task.customId }}
                className="block truncate rounded-md bg-warning/15 px-2 py-1 text-[11.5px] text-ink no-underline"
                title={`${task.customId} ${task.name}`}
              >
                {task.customId} {task.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DayBody({
  day,
  hours,
  events,
  selectedId,
  onSelect,
  onCommit,
  canDrag,
  drag,
  setDrag,
}: {
  day: string;
  hours: GridHours;
  events: CalendarEvent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCommit: (eventId: string, slot: { start: string; end: string }) => void;
  canDrag: boolean;
  drag: DragState | null;
  setDrag: (next: DragState | null | ((current: DragState | null) => DragState | null)) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayDropId(day) });
  const blocks = layoutLanes(blocksOfDay(events, day));
  const today = toDayKey(new Date()) === day;
  const marker = nowOffset(day, hours);

  const preview = (block: PlannerBlock): { start: string; end: string } => {
    if (!drag || drag.id !== block.id || drag.minutes === 0) {
      return { start: block.start, end: block.end };
    }

    if (drag.kind === 'move') {
      return moveBlock(block, drag.minutes);
    }

    return resizeBlock(block, drag.kind === 'start' ? 'start' : 'end', drag.minutes);
  };

  const commit = (block: PlannerBlock, kind: DragKind, minutes: number): void => {
    if (minutes === 0) {
      return;
    }

    onCommit(
      block.id,
      kind === 'move'
        ? moveBlock(block, minutes)
        : resizeBlock(block, kind === 'start' ? 'start' : 'end', minutes),
    );
  };

  const onPointerDown =
    (block: PlannerBlock, kind: DragKind) =>
    (event: ReactPointerEvent<HTMLElement>): void => {
      if (!canDrag || block.external) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      onSelect(block.id);
      setDrag({ id: block.id, kind, origin: event.clientY, minutes: 0 });
    };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>): void => {
    setDrag((current) =>
      current ? { ...current, minutes: minutesOfPixels(event.clientY - current.origin) } : current,
    );
  };

  const onPointerUp = (block: PlannerBlock) => (): void => {
    setDrag((current) => {
      if (current && current.id === block.id) {
        commit(block, current.kind, current.minutes);
      }

      return null;
    });
  };

  const onKeyDown =
    (block: PlannerBlock, kind: DragKind) =>
    (event: ReactKeyboardEvent<HTMLElement>): void => {
      if (block.external) {
        return;
      }

      const step = event.key === 'ArrowDown' ? KEY_STEP : event.key === 'ArrowUp' ? -KEY_STEP : 0;

      if (step !== 0) {
        event.preventDefault();
        commit(block, kind, step);
      }
    };

  return (
    <div
      ref={setNodeRef}
      data-day={day}
      className={cn(
        'relative min-w-0 border-l border-line bg-[linear-gradient(to_bottom,rgb(var(--line))_1px,transparent_1px)]',
        today && 'bg-accent/[0.04]',
        isOver && 'bg-accent/10',
      )}
      style={{ height: gridHeight(hours), backgroundSize: `100% ${String(HOUR_PX)}px` }}
    >
      {marker === null ? null : (
        <div
          aria-hidden="true"
          className="absolute left-0 right-0 z-[2] h-0.5 bg-danger"
          style={{ top: marker }}
        />
      )}

      {blocks.map(({ block, lane, lanes }) => {
        const geometry = blockGeometry(preview(block), day, hours);
        const width = 100 / lanes;

        return (
          <div
            key={block.id}
            className="absolute px-[3px]"
            style={{
              top: geometry.top,
              height: Math.max(geometry.height, 22),
              left: `${String(lane * width)}%`,
              width: `${String(width)}%`,
            }}
          >
            <button
              type="button"
              aria-pressed={selectedId === block.id}
              onPointerDown={onPointerDown(block, 'move')}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp(block)}
              onKeyDown={onKeyDown(block, 'move')}
              onClick={() => {
                onSelect(block.id);
              }}
              className={cn(
                'flex h-full w-full flex-col items-start gap-0.5 overflow-hidden rounded-lg px-2 py-1 text-left text-[12px]',
                block.kind === 'task'
                  ? 'border border-accent/60 bg-accent/20'
                  : 'border border-info/50 bg-info/[0.16]',
                selectedId === block.id && 'outline outline-2 outline-offset-1 outline-accent',
                canDrag && !block.external ? 'cursor-grab' : 'cursor-pointer',
              )}
            >
              <span className="w-full truncate font-semibold text-ink">{block.title}</span>
              <span className="text-[11px] text-body">{blockRangeLabel(block, day)}</span>
            </button>

            {canDrag && !block.external ? (
              <>
                <span
                  role="separator"
                  aria-label={`Mudar o início de ${block.title}`}
                  tabIndex={0}
                  onPointerDown={onPointerDown(block, 'start')}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp(block)}
                  onKeyDown={onKeyDown(block, 'start')}
                  className="absolute left-[3px] right-[3px] top-0 h-2 cursor-ns-resize rounded-t-lg"
                />
                <span
                  role="separator"
                  aria-label={`Mudar o fim de ${block.title}`}
                  tabIndex={0}
                  onPointerDown={onPointerDown(block, 'end')}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp(block)}
                  onKeyDown={onKeyDown(block, 'end')}
                  className="absolute bottom-0 left-[3px] right-[3px] h-2 cursor-ns-resize rounded-b-lg"
                />
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Grade de horas do dia ou da semana. O cabeçalho (rótulo do dia e prazos) e o
 * corpo são duas grades com a mesma régua de colunas, então tudo fica alinhado
 * sem depender da altura da faixa de prazos.
 */
export function PlannerGrid(props: PlannerGridProps) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const { wsId, days, hours, dueTasks } = props;
  const single = days.length === 1;

  return (
    <div className="min-w-0 overflow-x-auto">
      <div
        className={cn(
          'overflow-hidden rounded-xl border border-line',
          single ? 'min-w-0' : 'min-w-[720px]',
        )}
      >
        <div
          className="grid border-b border-line bg-surface-2"
          style={{ gridTemplateColumns: templateColumns(days.length) }}
        >
          <div />
          {days.map((day) => (
            <DayHead key={day} wsId={wsId} day={day} dueTasks={dueTasks} single={single} />
          ))}
        </div>

        <div className="grid" style={{ gridTemplateColumns: templateColumns(days.length) }}>
          <div className="relative" style={{ height: gridHeight(hours) }}>
            {hourMarks(hours).map((mark) => (
              <span
                key={mark.hour}
                className="absolute right-2 text-[11px] text-muted"
                style={{ top: mark.top + 4 }}
              >
                {mark.label}
              </span>
            ))}
          </div>

          {days.map((day) => (
            <DayBody
              key={day}
              day={day}
              hours={hours}
              events={props.events}
              selectedId={props.selectedId}
              onSelect={props.onSelect}
              onCommit={props.onCommit}
              canDrag={props.canDrag}
              drag={drag}
              setDrag={setDrag}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
