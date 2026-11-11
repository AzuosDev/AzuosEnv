import {
  DndContext,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { PlannerTask } from '@/api/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { PageHeader } from '@/features/shell/components/page-header';
import { toDayKey } from '@/features/views/calendar-model';
import { useMinWidth } from '@/lib/use-min-width';
import { cn } from '@/lib/utils';
import { plannerQuery } from '../api';
import { usePlannerActions } from '../hooks/use-planner-actions';
import {
  PLANNER_MODES,
  PLANNER_MODE_LABEL,
  blockRangeLabel,
  dayOfDropId,
  gridHours,
  nextFreeSlot,
  offsetToIso,
  addMinutesIso,
  plannerRange,
  plannerRangeLabel,
  shiftPlanner,
  taskBlockMinutes,
  type PlannerMode,
} from '../planner-model';
import { EventDialog } from './event-dialog';
import { PlannerGrid } from './planner-grid';
import { PlannerMonth } from './planner-month';
import { UnscheduledPanel, taskOfDragId } from './unscheduled-panel';

/** A partir de 1024 a grade aceita arrastar e o recorte de semana e mês. */
const WIDE_PX = 1024;

/** Planner da pessoa: dia, semana e mês, com time-blocking e os prazos do dia. */
export function PlannerPage({ wsId }: { wsId: string }) {
  const wide = useMinWidth(WIDE_PX);
  const [anchor, setAnchor] = useState(() => toDayKey(new Date()));
  const [mode, setMode] = useState<PlannerMode>('week');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [eventOpen, setEventOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const effectiveMode: PlannerMode = wide ? mode : 'day';
  const range = useMemo(() => plannerRange(anchor, effectiveMode), [anchor, effectiveMode]);
  const planner = useQuery(plannerQuery(wsId, range.from, range.to));
  const actions = usePlannerActions(wsId, range);
  const events = useMemo(() => planner.data?.events ?? [], [planner.data]);
  const hours = useMemo(() => gridHours(events, range.days), [events, range.days]);
  const selected = events.find((event) => event.id === selectedId) ?? null;
  const editing = events.find((event) => event.id === editingId) ?? null;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const schedule = (task: PlannerTask): void => {
    const minutes = taskBlockMinutes(task);
    const slot = nextFreeSlot(range.days, events, minutes, hours);

    if (!slot) {
      toast.error('Nenhum horário livre neste período.');

      return;
    }

    void actions.scheduleTask(task, slot).then((event) => {
      if (event) {
        setSelectedId(event.id);
      }
    });
  };

  const onDragEnd = (drag: DragEndEvent): void => {
    const taskId = taskOfDragId(String(drag.active.id));
    const day = drag.over ? dayOfDropId(String(drag.over.id)) : null;
    const task = planner.data?.unscheduledTasks.find((item) => item.id === taskId);

    if (!task || !day || !drag.over) {
      return;
    }

    const top = drag.active.rect.current.translated?.top ?? drag.over.rect.top;
    const start = offsetToIso(day, top - drag.over.rect.top, hours);

    void actions
      .scheduleTask(task, { start, end: addMinutesIso(start, taskBlockMinutes(task)) })
      .then((event) => {
        if (event) {
          setSelectedId(event.id);
        }
      });
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 pb-10">
      <PageHeader
        wsId={wsId}
        title="Planner"
        description="Reserve o dia em blocos: arraste a tarefa para a grade ou use “Agendar”."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="nav"
                size="icon"
                aria-label="Período anterior"
                onClick={() => {
                  setAnchor(shiftPlanner(anchor, effectiveMode, -1));
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
                variant="nav"
                size="icon"
                aria-label="Próximo período"
                onClick={() => {
                  setAnchor(shiftPlanner(anchor, effectiveMode, 1));
                }}
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            <span className="text-[13px] font-semibold text-ink">
              {plannerRangeLabel(anchor, effectiveMode)}
            </span>

            {wide ? (
              <div
                role="group"
                aria-label="Recorte do Planner"
                className="flex overflow-hidden rounded-xl border border-line"
              >
                {PLANNER_MODES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={mode === value}
                    onClick={() => {
                      setMode(value);
                    }}
                    className={cn(
                      'h-9 px-3 text-[13px]',
                      mode === value
                        ? 'bg-accent/[0.16] font-semibold text-ink'
                        : 'text-muted hover:bg-surface-2 hover:text-ink',
                    )}
                  >
                    {PLANNER_MODE_LABEL[value]}
                  </button>
                ))}
              </div>
            ) : null}

            <Button
              variant="ghost"
              size="sm"
              disabled
              title="Disponível quando a integração com o Google entrar"
            >
              Conectar Google Agenda
            </Button>

            <Button
              size="sm"
              onClick={() => {
                setEditingId(null);
                setEventOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Novo evento
            </Button>
          </div>
        }
      />

      <div className="min-w-0 px-4 md:px-6">
        {planner.isPending ? (
          <Skeleton className="h-96 w-full rounded-xl" />
        ) : planner.isError ? (
          <EmptyState
            title="Não foi possível carregar o Planner"
            description="Tente de novo em instantes."
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={(args) => {
              const within = pointerWithin(args);

              return within.length > 0 ? within : closestCenter(args);
            }}
            onDragEnd={onDragEnd}
          >
            <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-start">
              <div className="flex w-full min-w-0 flex-col gap-4 lg:w-[300px] lg:shrink-0">
                <UnscheduledPanel
                  wsId={wsId}
                  tasks={planner.data.unscheduledTasks}
                  onSchedule={schedule}
                  canDrag={wide}
                />

                {selected ? (
                  <section
                    aria-label="Bloco selecionado"
                    className="flex flex-col gap-2 rounded-xl border border-scene-line bg-accent/10 p-3"
                  >
                    <span className="text-[11.5px] text-muted">Selecionado</span>
                    <span className="break-words text-[13px] font-semibold text-ink">
                      {selected.title}
                    </span>
                    <span className="text-[12.5px] text-body">
                      {blockRangeLabel(selected, toDayKey(new Date(selected.start)))}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingId(selected.id);
                          setEventOpen(true);
                        }}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedId(null);
                          void actions.removeEvent(selected);
                        }}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        {selected.taskId ? 'Remover do calendário' : 'Excluir evento'}
                      </Button>
                    </div>
                  </section>
                ) : null}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-3">
                {effectiveMode === 'month' ? (
                  <PlannerMonth
                    anchor={anchor}
                    days={range.days}
                    events={events}
                    dueTasks={planner.data.dueTasks}
                    onOpenDay={(day) => {
                      setAnchor(day);
                      setMode('day');
                    }}
                  />
                ) : (
                  <PlannerGrid
                    wsId={wsId}
                    days={range.days}
                    hours={hours}
                    events={events}
                    dueTasks={planner.data.dueTasks}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onCommit={(eventId, slot) => {
                      void actions.moveBlock(eventId, slot);
                    }}
                    canDrag={wide}
                  />
                )}

                <ul className="flex flex-wrap gap-4 text-[12px] text-muted">
                  <li className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-[3px] bg-accent/40" aria-hidden="true" />
                    Bloco de tarefa
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-[3px] bg-info/40" aria-hidden="true" />
                    Evento
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-[3px] bg-warning/40" aria-hidden="true" />
                    Prazo do dia
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="h-0.5 w-4 bg-danger" aria-hidden="true" />
                    Agora
                  </li>
                </ul>
              </div>
            </div>
          </DndContext>
        )}
      </div>

      <EventDialog
        open={eventOpen}
        onOpenChange={setEventOpen}
        day={range.days[0] ?? anchor}
        event={editing}
        onCreate={(body) => {
          void actions.saveEvent(body);
        }}
        onUpdate={(eventId, body) => {
          void actions.patchEvent(eventId, body);
        }}
      />
    </div>
  );
}
