import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Task } from '@/api/types';
import { Button } from '@/components/ui/button';
import { flattenGroups } from '@/features/tasks/task-model';
import type { ViewSurfaceProps } from '@/features/tasks/components/view-surface';
import { useMinWidth } from '@/lib/use-min-width';
import { cn } from '@/lib/utils';
import {
  CALENDAR_MODES,
  CALENDAR_MODE_LABEL,
  agendaDays,
  calendarRange,
  dayDropId,
  dayKeyOfDropId,
  dueForDay,
  parseDayKey,
  shiftAnchor,
  tasksByDay,
  tasksWithoutDate,
  toDayKey,
  weekdayLabels,
  type CalendarMode,
} from '../calendar-model';
import { viewOption, withViewOption } from '../view-options';
import { LoadMoreBar, TaskChip } from './view-parts';

/** Largura a partir da qual a grade aparece; abaixo dela a view vira agenda. */
const GRID_WIDTH = 768;

/** Id do destino "sem data": soltar ali limpa o prazo. */
const CLEAR_DROP_ID = 'calendar-clear-due';

const collision: CollisionDetection = (args) => {
  const found = pointerWithin(args);

  return found.length > 0 ? found : closestCenter(args);
};

function QuickDayAdd({
  day,
  surface,
  onDone,
}: {
  day: string;
  surface: ViewSurfaceProps;
  onDone: () => void;
}) {
  const [name, setName] = useState('');

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();

        const trimmed = name.trim();

        if (trimmed !== '') {
          surface.actions.create.mutate({
            body: { name: trimmed, dueAt: parseDayKey(day).toISOString() },
          });
        }

        onDone();
      }}
    >
      <label className="sr-only" htmlFor={`calendar-add-${day}`}>
        Nome da tarefa do dia
      </label>
      <input
        id={`calendar-add-${day}`}
        autoFocus
        value={name}
        placeholder="Nome e Enter"
        onChange={(event) => {
          setName(event.target.value);
        }}
        onBlur={onDone}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onDone();
          }
        }}
        className="h-8 w-full rounded-lg border border-accent bg-surface px-2 text-[12px] text-ink outline-none"
      />
    </form>
  );
}

function DayCell({
  day,
  label,
  items,
  surface,
  creating,
  onCreate,
  onDone,
  inRange,
  isToday,
  isWeekend,
  monthLabel,
}: {
  day: string;
  label: string;
  items: Task[];
  surface: ViewSurfaceProps;
  creating: boolean;
  onCreate: () => void;
  onDone: () => void;
  inRange: boolean;
  isToday: boolean;
  isWeekend: boolean;
  monthLabel: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayDropId(day) });

  return (
    <div
      ref={setNodeRef}
      data-day={day}
      className={cn(
        'flex min-h-28 min-w-0 flex-col gap-1.5 border-b border-r border-line p-1.5',
        isWeekend ? 'bg-paper-2' : 'bg-surface',
        !inRange && 'opacity-55',
        isOver && 'ring-1 ring-inset ring-accent',
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="flex items-center gap-1 text-[12px]">
          <span
            className={cn(
              'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 font-semibold',
              isToday ? 'bg-accent text-on-signal' : 'text-body',
            )}
          >
            {label}
          </span>
          {!inRange ? <span className="text-muted">{monthLabel}</span> : null}
        </span>

        {surface.canEdit ? (
          <button
            type="button"
            aria-label={`Nova tarefa em ${label} de ${monthLabel}`}
            onClick={onCreate}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {creating ? <QuickDayAdd day={day} surface={surface} onDone={onDone} /> : null}

      <div className="flex min-w-0 flex-col gap-1">
        {items.map((task) => (
          <TaskChip key={task.id} task={task} surface={surface} draggable={surface.canEdit} />
        ))}
      </div>
    </div>
  );
}

function UndatedPanel({ tasks, surface }: { tasks: Task[]; surface: ViewSurfaceProps }) {
  const { setNodeRef, isOver } = useDroppable({ id: CLEAR_DROP_ID });

  return (
    <section
      ref={setNodeRef}
      aria-label="Tarefas sem data"
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-xl border border-line bg-surface p-3',
        isOver && 'ring-1 ring-accent',
      )}
    >
      <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
        Sem data ({tasks.length})
      </h3>

      {tasks.length === 0 ? (
        <p className="text-[12.5px] text-muted">
          Nada sem data por aqui. Arraste uma tarefa para cá para tirar o prazo.
        </p>
      ) : (
        <div className="flex min-w-0 flex-col gap-1">
          {tasks.map((task) => (
            <TaskChip key={task.id} task={task} surface={surface} draggable={surface.canEdit} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * View Calendário: grade de mês ou semana, arrastar muda o prazo, clicar no dia
 * cria tarefa e as tarefas sem data ficam à parte. Abaixo de 768 px a grade dá
 * lugar a uma agenda em lista por dia, porque sete colunas não caber no celular.
 */
export function CalendarView(surface: ViewSurfaceProps) {
  const mode = viewOption<CalendarMode>(surface.config, 'calendarMode', CALENDAR_MODES, 'month');
  const [anchor, setAnchor] = useState(() => toDayKey(new Date()));
  const [creating, setCreating] = useState<string | null>(null);
  const wide = useMinWidth(GRID_WIDTH);
  const tasks = useMemo(() => flattenGroups(surface.groups), [surface.groups]);
  const byDay = useMemo(() => tasksByDay(tasks), [tasks]);
  const undated = useMemo(() => tasksWithoutDate(tasks), [tasks]);
  const range = useMemo(() => calendarRange(anchor, mode), [anchor, mode]);
  const weekdays = useMemo(() => weekdayLabels(), []);
  const [dragging, setDragging] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const onDragEnd = ({ active, over }: DragEndEvent): void => {
    setDragging(null);

    if (!over) {
      return;
    }

    const task = tasks.find((item) => item.id === String(active.id));

    if (!task) {
      return;
    }

    if (String(over.id) === CLEAR_DROP_ID) {
      if (task.dueAt !== null) {
        surface.actions.patch.mutate({
          id: task.id,
          body: { dueAt: null },
          optimistic: { dueAt: null },
        });
      }

      return;
    }

    const day = dayKeyOfDropId(String(over.id));

    if (!day) {
      return;
    }

    const dueAt = dueForDay(task, day);

    if (dueAt !== task.dueAt) {
      surface.actions.patch.mutate({ id: task.id, body: { dueAt }, optimistic: { dueAt } });
    }
  };

  const agenda = agendaDays(range, byDay);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={({ active }) => {
        setDragging(tasks.find((item) => item.id === String(active.id)) ?? null);
      }}
      onDragCancel={() => {
        setDragging(null);
      }}
      onDragEnd={onDragEnd}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-10 md:px-6">
        <div className="flex flex-wrap items-center gap-2 py-2">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Período anterior"
              onClick={() => {
                setAnchor((current) => shiftAnchor(current, mode, -1));
              }}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAnchor(toDayKey(new Date()));
              }}
            >
              Hoje
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Período seguinte"
              onClick={() => {
                setAnchor((current) => shiftAnchor(current, mode, 1));
              }}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <h2 className="min-w-0 flex-1 truncate text-[14px] font-semibold capitalize text-ink">
            {range.label}
          </h2>

          <div className="flex items-center gap-1">
            {CALENDAR_MODES.map((option) => (
              <Button
                key={option}
                variant="ghost"
                size="sm"
                aria-pressed={mode === option}
                disabled={!surface.canEditConfig}
                className={cn(mode === option && 'border-accent text-ink')}
                onClick={() => {
                  surface.updateConfig((config) => withViewOption(config, 'calendarMode', option));
                }}
              >
                {CALENDAR_MODE_LABEL[option]}
              </Button>
            ))}
          </div>
        </div>

        {wide ? (
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row">
            <div className="min-w-0 flex-1 overflow-hidden rounded-xl border-l border-t border-line">
              <div className="grid grid-cols-7">
                {weekdays.map((weekday) => (
                  <div
                    key={weekday}
                    className="border-b border-r border-line bg-surface-2 px-2 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted"
                  >
                    {weekday}
                  </div>
                ))}

                {range.days.map((day) => (
                  <DayCell
                    key={day.key}
                    day={day.key}
                    label={String(day.number)}
                    monthLabel={day.month}
                    items={byDay.get(day.key) ?? []}
                    surface={surface}
                    creating={creating === day.key}
                    inRange={day.inRange}
                    isToday={day.isToday}
                    isWeekend={day.isWeekend}
                    onCreate={() => {
                      setCreating(day.key);
                    }}
                    onDone={() => {
                      setCreating(null);
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="w-full shrink-0 lg:w-64">
              <UndatedPanel tasks={undated} surface={surface} />
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-4">
            {agenda.length === 0 ? (
              <p className="text-[13px] text-muted">Nenhuma tarefa com prazo neste período.</p>
            ) : null}

            {agenda.map((day) => (
              <section key={day.key} className="flex min-w-0 flex-col gap-1.5">
                <h3
                  className={cn(
                    'text-[12.5px] font-semibold capitalize',
                    day.isToday ? 'text-accent' : 'text-body',
                  )}
                >
                  {day.label}
                </h3>
                {day.items.map((task) => (
                  <TaskChip key={task.id} task={task} surface={surface} />
                ))}
              </section>
            ))}

            <UndatedPanel tasks={undated} surface={surface} />
          </div>
        )}

        <LoadMoreBar surface={surface} />
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging ? (
          <div className="rounded-lg border border-accent bg-surface px-2 py-1 text-[12px] text-ink shadow-xl">
            {dragging.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
