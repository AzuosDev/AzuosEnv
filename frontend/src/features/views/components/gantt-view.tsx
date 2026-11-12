import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { Task } from '@/api/types';
import { Button } from '@/components/ui/button';
import { flattenGroups } from '@/features/tasks/task-model';
import type { ViewSurfaceProps } from '@/features/tasks/components/view-surface';
import { formatDue } from '@/features/tasks/task-fields';
import { cn } from '@/lib/utils';
import {
  BAR_HEIGHT,
  GANTT_SCALES,
  GANTT_SCALE_LABEL,
  NAME_COLUMN_CLASS,
  ROW_HEIGHT,
  addDaysToKey,
  barOf,
  daysOfOffset,
  ganttArrows,
  ganttRange,
  moveToDay,
  todayOffset,
  type GanttRange,
  type GanttScale,
} from '../gantt-model';
import { viewOption, withViewOption } from '../view-options';
import { taskDependenciesQuery } from '../views-data-api';
import { LoadMoreBar, ScrollArea, statusDotClass } from './view-parts';

/** O que o arrasto está mudando na barra. */
type DragKind = 'move' | 'start' | 'due';

interface DragState {
  taskId: string;
  kind: DragKind;
  /** Pixel do ponteiro quando o arrasto começou. */
  origin: number;
  /** Quantos dias o ponteiro já andou. */
  days: number;
}

/** Quantos dias um passo de teclado move ou redimensiona. */
const KEY_STEP = 1;

function barColorClass(surface: ViewSurfaceProps, task: Task): string {
  return statusDotClass(surface, task);
}

interface Row {
  task: Task;
  bar: ReturnType<typeof barOf>;
}

function arrowPath(from: { row: number; x: number }, to: { row: number; x: number }): string {
  const y1 = from.row * ROW_HEIGHT + ROW_HEIGHT / 2;
  const y2 = to.row * ROW_HEIGHT + ROW_HEIGHT / 2;
  const turn = Math.max(from.x + 12, to.x - 12);

  return `M ${String(from.x)} ${String(y1)} H ${String(turn)} V ${String(y2)} H ${String(to.x)}`;
}

/**
 * View Gantt: escala dia, semana ou mês, barras que se arrastam e se
 * redimensionam, setas de dependência, linha de hoje e marco em losango. A
 * coluna de nomes fica fixa e só o gráfico rola para os lados.
 */
export function GanttView(surface: ViewSurfaceProps) {
  const scale = viewOption<GanttScale>(surface.config, 'ganttScale', GANTT_SCALES, 'day');
  const tasks = useMemo(() => flattenGroups(surface.groups), [surface.groups]);
  const range = useMemo(() => ganttRange(tasks, scale), [scale, tasks]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const ids = useMemo(() => tasks.map((task) => task.id), [tasks]);
  const dependencies = useQuery(taskDependenciesQuery(surface.wsId, ids));
  const arrows = useMemo(() => ganttArrows(dependencies.data ?? [], ids), [dependencies.data, ids]);

  const rows: Row[] = useMemo(
    () => tasks.map((task) => ({ task, bar: barOf(task, range) })),
    [range, tasks],
  );

  const now = todayOffset(range);
  const empty = rows.length === 0;

  /** Barra com o arrasto em andamento já aplicado, para a tela acompanhar. */
  const preview = (row: Row): { left: number; width: number } | null => {
    if (!row.bar) {
      return null;
    }

    if (!drag || drag.taskId !== row.task.id || drag.days === 0) {
      return { left: row.bar.left, width: row.bar.width };
    }

    const shift = drag.days * range.pxPerDay;

    if (drag.kind === 'move') {
      return { left: row.bar.left + shift, width: row.bar.width };
    }

    if (drag.kind === 'start') {
      const left = Math.min(row.bar.left + shift, row.bar.left + row.bar.width - range.pxPerDay);

      return { left, width: row.bar.left + row.bar.width - left };
    }

    return { left: row.bar.left, width: Math.max(row.bar.width + shift, range.pxPerDay) };
  };

  const commit = (task: Task, kind: DragKind, days: number): void => {
    const bar = barOf(task, range);

    if (!bar || days === 0) {
      return;
    }

    if (kind === 'move') {
      surface.actions.patch.mutate({
        id: task.id,
        body: {
          ...(task.startAt
            ? { startAt: moveToDay(task.startAt, addDaysToKey(bar.startDay, days), false) }
            : {}),
          dueAt: moveToDay(task.dueAt, addDaysToKey(bar.dueDay, days), task.dueHasTime),
        },
        optimistic: {
          ...(task.startAt
            ? { startAt: moveToDay(task.startAt, addDaysToKey(bar.startDay, days), false) }
            : {}),
          dueAt: moveToDay(task.dueAt, addDaysToKey(bar.dueDay, days), task.dueHasTime),
        },
      });

      return;
    }

    if (kind === 'start') {
      const day = addDaysToKey(bar.startDay, days);
      const startAt = moveToDay(task.startAt, day > bar.dueDay ? bar.dueDay : day, false);

      surface.actions.patch.mutate({ id: task.id, body: { startAt }, optimistic: { startAt } });

      return;
    }

    const day = addDaysToKey(bar.dueDay, days);
    const dueAt = moveToDay(task.dueAt, day < bar.startDay ? bar.startDay : day, task.dueHasTime);

    surface.actions.patch.mutate({ id: task.id, body: { dueAt }, optimistic: { dueAt } });
  };

  const onPointerDown =
    (task: Task, kind: DragKind) =>
    (event: ReactPointerEvent<HTMLElement>): void => {
      if (!surface.canEdit) {
        return;
      }

      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrag({ taskId: task.id, kind, origin: event.clientX, days: 0 });
    };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>): void => {
    setDrag((current) =>
      current ? { ...current, days: daysOfOffset(range, event.clientX - current.origin) } : current,
    );
  };

  const onPointerUp = (task: Task) => (): void => {
    setDrag((current) => {
      if (current && current.taskId === task.id) {
        commit(task, current.kind, current.days);
      }

      return null;
    });
  };

  const onKeyDown =
    (task: Task, kind: DragKind) =>
    (event: ReactKeyboardEvent<HTMLElement>): void => {
      if (!surface.canEdit) {
        return;
      }

      const step =
        event.key === 'ArrowRight' ? KEY_STEP : event.key === 'ArrowLeft' ? -KEY_STEP : 0;

      if (step !== 0) {
        event.preventDefault();
        commit(task, kind, step);
      }
    };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 px-3 pb-2 md:px-6">
        <p className="min-w-0 flex-1 text-[12px] text-muted">
          Arraste a barra para mudar início e prazo; as pontas esticam cada data. Losango é marco.
        </p>
        {GANTT_SCALES.map((option) => (
          <Button
            key={option}
            variant="ghost"
            size="sm"
            aria-pressed={scale === option}
            disabled={!surface.canEditConfig}
            className={cn(scale === option && 'border-accent text-ink')}
            onClick={() => {
              surface.updateConfig((config) => withViewOption(config, 'ganttScale', option));
            }}
          >
            {GANTT_SCALE_LABEL[option]}
          </Button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 overflow-y-auto px-3 pb-10 md:px-6">
        <div className="flex min-w-0 flex-1 rounded-xl border border-line">
          <div className={cn('shrink-0 border-r border-line bg-surface', NAME_COLUMN_CLASS)}>
            <div
              className="flex items-center border-b border-line bg-surface-2 px-3 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted"
              style={{ height: `${String(ROW_HEIGHT)}px` }}
            >
              Tarefa
            </div>

            {rows.map((row) => (
              <div
                key={row.task.id}
                className="flex items-center gap-2 border-b border-line/60 px-3"
                style={{ height: `${String(ROW_HEIGHT)}px` }}
              >
                <span
                  className={cn('h-2 w-2 shrink-0 rounded-full', barColorClass(surface, row.task))}
                  aria-hidden="true"
                />
                <span className="shrink-0 text-[11.5px] text-muted">{row.task.customId}</span>
                <Link
                  to="/w/$wsId/t/$customId"
                  params={{ wsId: surface.wsId, customId: row.task.customId }}
                  className="min-w-0 truncate text-[13px] text-ink hover:underline"
                >
                  {row.task.name}
                </Link>
              </div>
            ))}
          </div>

          <ScrollArea label="Gráfico de Gantt" className="min-w-0 flex-1">
            <div style={{ width: `${String(range.width)}px` }}>
              <div
                className="flex border-b border-line bg-surface-2"
                style={{ height: `${String(ROW_HEIGHT)}px` }}
              >
                {range.columns.map((column) => (
                  <div
                    key={column.key}
                    style={{ width: `${String(column.days * range.pxPerDay)}px` }}
                    className={cn(
                      'flex shrink-0 items-center justify-center border-l border-line text-[11px]',
                      column.isNow ? 'font-semibold text-accent' : 'text-muted',
                    )}
                  >
                    {column.label}
                  </div>
                ))}
              </div>

              <div
                className="relative"
                style={{ height: `${String(rows.length * ROW_HEIGHT)}px` }}
                onPointerMove={drag ? onPointerMove : undefined}
              >
                <Grid range={range} />

                {now === null ? null : (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute top-0 z-10 w-0.5 bg-accent"
                    style={{ left: `${String(now)}px`, height: '100%' }}
                  />
                )}

                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 top-0 h-full w-full"
                >
                  {arrows.map((arrow) => {
                    const fromIndex = rows.findIndex((row) => row.task.id === arrow.fromId);
                    const toIndex = rows.findIndex((row) => row.task.id === arrow.toId);
                    const fromBar = rows[fromIndex]?.bar;
                    const toBar = rows[toIndex]?.bar;

                    if (!fromBar || !toBar) {
                      return null;
                    }

                    return (
                      <path
                        key={`${arrow.fromId}-${arrow.toId}`}
                        d={arrowPath(
                          { row: fromIndex, x: fromBar.left + fromBar.width },
                          { row: toIndex, x: toBar.left },
                        )}
                        fill="none"
                        stroke="rgb(var(--muted))"
                        strokeWidth="1.5"
                        markerEnd="url(#gantt-arrow)"
                      />
                    );
                  })}
                  <defs>
                    <marker
                      id="gantt-arrow"
                      viewBox="0 0 8 8"
                      refX="6"
                      refY="4"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto"
                    >
                      <path d="M 0 1 L 6 4 L 0 7 z" fill="rgb(var(--muted))" />
                    </marker>
                  </defs>
                </svg>

                {rows.map((row, index) => {
                  const box = preview(row);

                  if (!box || !row.bar) {
                    return null;
                  }

                  const label = `${row.task.name}: ${formatDue(row.task.startAt)} → ${formatDue(row.task.dueAt, row.task.dueHasTime)}`;

                  if (row.bar.milestone) {
                    return (
                      <button
                        key={row.task.id}
                        type="button"
                        aria-label={`Marco ${label}`}
                        title={label}
                        disabled={!surface.canEdit}
                        onPointerDown={onPointerDown(row.task, 'move')}
                        onPointerUp={onPointerUp(row.task)}
                        onKeyDown={onKeyDown(row.task, 'move')}
                        className={cn(
                          'absolute z-10 rotate-45 border',
                          barColorClass(surface, row.task),
                          'border-ink/20',
                        )}
                        style={{
                          left: `${String(box.left + range.pxPerDay / 2 - 7)}px`,
                          top: `${String(index * ROW_HEIGHT + (ROW_HEIGHT - 14) / 2)}px`,
                          width: '14px',
                          height: '14px',
                        }}
                      />
                    );
                  }

                  return (
                    <div
                      key={row.task.id}
                      className="absolute z-10 flex items-center"
                      style={{
                        left: `${String(box.left)}px`,
                        width: `${String(box.width)}px`,
                        top: `${String(index * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2)}px`,
                        height: `${String(BAR_HEIGHT)}px`,
                      }}
                    >
                      {surface.canEdit ? (
                        <button
                          type="button"
                          aria-label={`Mudar o início de ${row.task.name}`}
                          onPointerDown={onPointerDown(row.task, 'start')}
                          onPointerUp={onPointerUp(row.task)}
                          onKeyDown={onKeyDown(row.task, 'start')}
                          className="h-full w-2 shrink-0 cursor-col-resize rounded-l-md bg-ink/15 hover:bg-accent"
                        />
                      ) : null}

                      <button
                        type="button"
                        title={label}
                        aria-label={`Barra de ${label}`}
                        disabled={!surface.canEdit}
                        onPointerDown={onPointerDown(row.task, 'move')}
                        onPointerUp={onPointerUp(row.task)}
                        onKeyDown={onKeyDown(row.task, 'move')}
                        className={cn(
                          'h-full min-w-0 flex-1 cursor-grab truncate rounded-md border border-ink/20 px-1.5 text-left text-[11px] text-ink',
                          barColorClass(surface, row.task),
                          'bg-opacity-40',
                        )}
                      >
                        {formatDue(row.task.dueAt, row.task.dueHasTime)}
                      </button>

                      {surface.canEdit ? (
                        <button
                          type="button"
                          aria-label={`Mudar o prazo de ${row.task.name}`}
                          onPointerDown={onPointerDown(row.task, 'due')}
                          onPointerUp={onPointerUp(row.task)}
                          onKeyDown={onKeyDown(row.task, 'due')}
                          className="h-full w-2 shrink-0 cursor-col-resize rounded-r-md bg-ink/15 hover:bg-accent"
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>

      {empty ? (
        <p className="px-3 pb-4 text-[13px] text-muted md:px-6">
          Nenhuma tarefa nesta view. Crie tarefas na Lista para ver o Gantt desenhar.
        </p>
      ) : null}

      <LoadMoreBar surface={surface} />
    </div>
  );
}

/** Faixas verticais do gráfico, uma por coluna da escala. */
function Grid({ range }: { range: GanttRange }) {
  return (
    <div aria-hidden="true" className="absolute inset-0 flex">
      {range.columns.map((column) => (
        <div
          key={column.key}
          style={{ width: `${String(column.days * range.pxPerDay)}px` }}
          className={cn('shrink-0 border-l border-line/60', column.isNow && 'bg-accent/5')}
        />
      ))}
    </div>
  );
}
