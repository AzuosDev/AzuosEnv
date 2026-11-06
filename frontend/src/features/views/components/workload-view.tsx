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
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Task, WorkloadMember } from '@/api/types';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import type { ViewSurfaceProps } from '@/features/tasks/components/view-surface';
import { UNASSIGNED_KEY } from '@/features/tasks/task-fields';
import { cn } from '@/lib/utils';
import { toDayKey } from '../calendar-model';
import { viewNumberOption, viewOption, withViewOption } from '../view-options';
import {
  CAPACITY_CLASS,
  CAPACITY_LABEL,
  WORKLOAD_METRICS,
  WORKLOAD_METRIC_LABEL,
  WORKLOAD_SPANS,
  capacityTone,
  formatMetricValue,
  personDropId,
  shiftWorkloadAnchor,
  userIdOfDropId,
  workloadRange,
  type WorkloadSpan,
} from '../workload-model';
import { workloadQuery } from '../views-data-api';
import { LoadMoreBar, ScrollArea, TaskChip } from './view-parts';

const collision: CollisionDetection = (args) => {
  const found = pointerWithin(args);

  return found.length > 0 ? found : closestCenter(args);
};

/** Coluna da pessoa: estreita no celular, confortável a partir de 768 px. */
const PERSON_CLASS = 'w-[132px] min-w-[132px] md:w-[180px] md:min-w-[180px]';

/** Cada dia tem largura fixa; o container rola por dentro quando não cabe. */
const DAY_CLASS = 'w-[64px] min-w-[64px] md:w-[72px] md:min-w-[72px]';

function PersonCard({
  userId,
  name,
  tasks,
  surface,
}: {
  userId: string;
  name: string;
  tasks: Task[];
  surface: ViewSurfaceProps;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: personDropId(userId) });

  return (
    <section
      ref={setNodeRef}
      aria-label={`Tarefas de ${name}`}
      className={cn(
        'flex min-w-0 flex-col gap-1.5 rounded-xl border border-line bg-surface p-2.5',
        isOver && 'ring-1 ring-accent',
      )}
    >
      <h3 className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
        <span className="min-w-0 truncate">{name}</span>
        <span className="text-[11.5px] font-normal text-muted">{tasks.length}</span>
      </h3>

      {tasks.length === 0 ? (
        <p className="text-[12px] text-muted">Arraste uma tarefa para cá.</p>
      ) : (
        tasks.map((task) => (
          <TaskChip key={task.id} task={task} surface={surface} draggable={surface.canEdit} />
        ))
      )}
    </section>
  );
}

/**
 * View Workload: carga por pessoa e dia pelo GET /workload, com cor por
 * capacidade, e cartões por pessoa onde arrastar a tarefa reatribui.
 */
export function WorkloadView(surface: ViewSurfaceProps) {
  const metric = viewOption(surface.config, 'workloadMetric', WORKLOAD_METRICS, 'tasks');
  const span = viewNumberOption(surface.config, 'workloadSpan', WORKLOAD_SPANS, 7) as WorkloadSpan;
  const [anchor, setAnchor] = useState(() => toDayKey(new Date()));
  const range = useMemo(() => workloadRange(anchor, span), [anchor, span]);
  const workload = useQuery(
    workloadQuery(surface.wsId, {
      from: range.from,
      to: range.to,
      metric,
      location: surface.location,
      locationId: surface.locationId,
    }),
  );
  const [dragging, setDragging] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const tasks = useMemo(() => surface.groups.flatMap((group) => group.items), [surface.groups]);
  const byPerson = useMemo(() => {
    const map = new Map<string, Task[]>();

    for (const group of surface.groups) {
      map.set(group.key, group.items);
    }

    return map;
  }, [surface.groups]);

  const members: WorkloadMember[] = workload.data?.members ?? [];

  /**
   * Um cartão por pessoa do workspace, não só por quem já tem tarefa: é o que
   * permite arrastar para alguém que está sem nada. "Sem responsável" entra no
   * fim para o arrasto também poder tirar o responsável.
   */
  const cards = useMemo(() => {
    const people = surface.members.map((member) => ({
      userId: member.userId.id,
      name: member.userId.name,
    }));
    const known = new Set(people.map((person) => person.userId));
    const extra = surface.groups
      .filter((group) => group.key !== UNASSIGNED_KEY && !known.has(group.key))
      .map((group) => ({ userId: group.key, name: group.label }));
    const unassigned = surface.groups.find((group) => group.key === UNASSIGNED_KEY);

    return [
      ...people,
      ...extra,
      { userId: UNASSIGNED_KEY, name: unassigned?.label ?? 'Sem responsável' },
    ];
  }, [surface.groups, surface.members]);

  const onDragEnd = ({ active, over }: DragEndEvent): void => {
    setDragging(null);

    const task = tasks.find((item) => item.id === String(active.id));
    const target = over ? userIdOfDropId(String(over.id)) : null;

    if (!task || target === null) {
      return;
    }

    const assigneeIds = target === UNASSIGNED_KEY ? [] : [target];

    if (assigneeIds.join(',') === task.assigneeIds.join(',')) {
      return;
    }

    surface.actions.patch.mutate({
      id: task.id,
      body: { assigneeIds },
      optimistic: { assigneeIds },
    });
  };

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
                setAnchor((current) => shiftWorkloadAnchor(current, span, -1));
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
                setAnchor((current) => shiftWorkloadAnchor(current, span, 1));
              }}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="flex items-center gap-1">
            {WORKLOAD_METRICS.map((option) => (
              <Button
                key={option}
                variant="ghost"
                size="sm"
                aria-pressed={metric === option}
                disabled={!surface.canEditConfig}
                className={cn(metric === option && 'border-accent text-ink')}
                onClick={() => {
                  surface.updateConfig((config) =>
                    withViewOption(config, 'workloadMetric', option),
                  );
                }}
              >
                {WORKLOAD_METRIC_LABEL[option]}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            {WORKLOAD_SPANS.map((option) => (
              <Button
                key={option}
                variant="ghost"
                size="sm"
                aria-pressed={span === option}
                disabled={!surface.canEditConfig}
                className={cn(span === option && 'border-accent text-ink')}
                onClick={() => {
                  surface.updateConfig((config) => withViewOption(config, 'workloadSpan', option));
                }}
              >
                {String(option)} dias
              </Button>
            ))}
          </div>
        </div>

        <ul className="flex flex-wrap items-center gap-3 pb-2 text-[12px] text-muted">
          {(['free', 'limit', 'over'] as const).map((tone) => (
            <li key={tone} className="flex items-center gap-1.5">
              <span
                className={cn('h-2.5 w-2.5 rounded', CAPACITY_CLASS[tone])}
                aria-hidden="true"
              />
              {CAPACITY_LABEL[tone]}
            </li>
          ))}
        </ul>

        {workload.isPending ? (
          <div className="py-6">
            <Spinner label="Carregando a carga" />
          </div>
        ) : null}

        {workload.isError ? (
          <p className="py-4 text-[13px] text-danger">Não deu para carregar a carga do período.</p>
        ) : null}

        {workload.data ? (
          <ScrollArea label="Carga por pessoa e dia" className="rounded-xl border border-line">
            <table className="border-separate border-spacing-0 text-[12.5px]">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className={cn(
                      'sticky left-0 z-10 border-b border-r border-line bg-surface-2 px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted',
                      PERSON_CLASS,
                    )}
                  >
                    Pessoa
                  </th>
                  {range.days.map((day) => (
                    <th
                      key={day.key}
                      scope="col"
                      className={cn(
                        DAY_CLASS,
                        'border-b border-l border-line bg-surface-2 px-1 py-2 text-center text-[11.5px] font-semibold',
                        day.isToday ? 'text-accent' : 'text-muted',
                        day.isWeekend && 'bg-paper-2',
                      )}
                    >
                      {day.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.userId}>
                    <th
                      scope="row"
                      className={cn(
                        'sticky left-0 z-10 border-b border-r border-line bg-surface px-3 py-2 text-left font-normal',
                        PERSON_CLASS,
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Avatar name={member.name} className="h-6 w-6 shrink-0" />
                        <span className="min-w-0 truncate text-ink">{member.name}</span>
                      </span>
                      <span className="block pt-0.5 text-[11px] text-muted">
                        {formatMetricValue(member.total, metric) || '0'} ·{' '}
                        {formatMetricValue(member.capacityPerDay, metric) || '0'}/dia
                      </span>
                    </th>

                    {range.days.map((day) => {
                      const value = member.byDay[day.key] ?? 0;
                      const tone = capacityTone(value, member.capacityPerDay);

                      return (
                        <td
                          key={day.key}
                          className="border-b border-l border-line p-1 text-center"
                          title={`${member.name} em ${day.key}: ${formatMetricValue(value, metric) || '0'} (${CAPACITY_LABEL[tone]})`}
                        >
                          <span
                            className={cn(
                              'flex h-8 items-center justify-center rounded-lg font-semibold',
                              CAPACITY_CLASS[tone],
                            )}
                          >
                            {formatMetricValue(value, metric)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        ) : null}

        <h2 className="pb-2 pt-5 text-[13px] font-semibold text-ink">Tarefas por pessoa</h2>
        <p className="pb-2 text-[12px] text-muted">
          Arraste uma tarefa para outra pessoa para reatribuir.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <PersonCard
              key={card.userId}
              userId={card.userId}
              name={card.name}
              tasks={byPerson.get(card.userId) ?? []}
              surface={surface}
            />
          ))}
        </div>

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
