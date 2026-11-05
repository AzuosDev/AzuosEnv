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
import { SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Link } from '@tanstack/react-router';
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Task } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PriorityFlag } from '@/components/ui/priority-flag';
import { Spinner } from '@/components/ui/spinner';
import { StatusPill } from '@/components/ui/status-pill';
import { cn } from '@/lib/utils';
import { DUE_TONE_CLASS, dueTone, formatDue, formatDueLong, statusTone } from '../task-fields';
import { groupDropId, type TaskGroupState } from '../task-model';
import { AssigneeStack } from './assignee-stack';
import { QuickAdd } from './quick-add';
import { AssigneesPicker, DuePicker, PriorityPicker, StatusPicker } from './task-pickers';
import type { ViewSurfaceProps } from './view-surface';

type Row =
  | { kind: 'group'; group: TaskGroupState }
  | { kind: 'columns'; key: string }
  | { kind: 'task'; task: Task; groupKey: string }
  | { kind: 'add'; groupKey: string }
  | { kind: 'more'; groupKey: string; cursor: string };

const ROW_SIZE: Record<Row['kind'], number> = {
  group: 44,
  columns: 28,
  task: 48,
  add: 44,
  more: 44,
};

const GRID =
  'grid grid-cols-[28px_minmax(0,1fr)_72px] items-center gap-2 px-2 md:grid-cols-[28px_minmax(0,1fr)_132px_96px_112px] md:gap-3 md:px-3';

/** A colisão por ponteiro é a que acerta; o teclado cai no centro mais próximo. */
const collision: CollisionDetection = (args) => {
  const found = pointerWithin(args);

  return found.length > 0 ? found : closestCenter(args);
};

function rowsOf(groups: TaskGroupState[], collapsed: Set<string>, grouped: boolean): Row[] {
  const rows: Row[] = [];

  for (const group of groups) {
    if (grouped) {
      rows.push({ kind: 'group', group });
    }

    if (collapsed.has(group.key)) {
      continue;
    }

    rows.push({ kind: 'columns', key: group.key });

    for (const task of group.items) {
      rows.push({ kind: 'task', task, groupKey: group.key });
    }

    if (group.nextCursor) {
      rows.push({ kind: 'more', groupKey: group.key, cursor: group.nextCursor });
    }

    rows.push({ kind: 'add', groupKey: group.key });
  }

  return rows;
}

function GroupHeader({
  group,
  collapsed,
  onToggle,
  surface,
}: {
  group: TaskGroupState;
  collapsed: boolean;
  onToggle: () => void;
  surface: ViewSurfaceProps;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: groupDropId(group.key) });
  const status = surface.statuses.find((item) => item.id === group.key);

  return (
    <div
      ref={setNodeRef}
      className={cn('flex items-center gap-2 pb-2 pt-3', isOver && 'bg-surface-2')}
    >
      <button
        type="button"
        aria-expanded={!collapsed}
        onClick={onToggle}
        className="flex h-9 items-center gap-2 rounded-lg px-1 text-left hover:bg-surface-2"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-muted" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted" aria-hidden="true" />
        )}
        <span className="sr-only">{collapsed ? 'Expandir' : 'Recolher'} grupo</span>
        {status ? (
          <StatusPill tone={statusTone(status.group, status.color)}>{group.label}</StatusPill>
        ) : (
          <StatusPill>{group.label}</StatusPill>
        )}
        <span className="text-[12px] text-muted">{group.items.length}</span>
      </button>
    </div>
  );
}

function TaskRow({
  task,
  surface,
  selected,
}: {
  task: Task;
  surface: ViewSurfaceProps;
  selected: boolean;
}) {
  const sortable = useSortable({
    id: task.id,
    disabled: !surface.canEdit,
    animateLayoutChanges: () => false,
  });
  const status = surface.statuses.find((item) => item.id === task.statusId);
  const tone = dueTone(task.dueAt);
  const edit = (body: Parameters<typeof surface.actions.patch.mutate>[0]['body']): void => {
    surface.actions.patch.mutate({ id: task.id, body });
  };

  return (
    <div
      ref={sortable.setNodeRef}
      className={cn(
        GRID,
        'min-h-12 border-b border-line/60',
        selected && 'bg-scene/40',
        sortable.isOver && !sortable.isDragging && 'ring-1 ring-accent',
        sortable.isDragging && 'opacity-40',
      )}
    >
      <div className="flex items-center gap-1">
        <Checkbox
          checked={selected}
          aria-label={`Selecionar ${task.name}`}
          onCheckedChange={() => {
            surface.onToggleSelect(task.id);
          }}
        />
      </div>

      <div className="flex min-w-0 items-center gap-2">
        {surface.canEdit ? (
          <button
            type="button"
            aria-label={`Arrastar ${task.name}`}
            className="hidden h-8 w-5 shrink-0 cursor-grab items-center justify-center text-muted hover:text-ink md:flex"
            {...sortable.attributes}
            {...sortable.listeners}
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}

        <StatusPicker
          statuses={surface.statuses}
          value={task.statusId}
          disabled={!surface.canEdit}
          onSelect={(statusId) => {
            const picked = surface.statuses.find((item) => item.id === statusId);

            surface.actions.patch.mutate({
              id: task.id,
              body: { statusId },
              ...(picked ? { optimistic: { statusId, statusGroup: picked.group } } : {}),
            });
          }}
        >
          <button
            type="button"
            className="shrink-0 rounded-full"
            aria-label={`Status de ${task.name}: ${status?.name ?? 'sem status'}`}
          >
            <span
              className={cn(
                'block h-2.5 w-2.5 rounded-full',
                status?.group === 'done' || status?.group === 'closed'
                  ? 'bg-success'
                  : status?.group === 'active'
                    ? 'bg-info'
                    : 'bg-muted',
              )}
            />
          </button>
        </StatusPicker>

        <span className="shrink-0 text-[12px] text-muted">{task.customId}</span>
        <Link
          to="/w/$wsId/t/$customId"
          params={{ wsId: surface.wsId, customId: task.customId }}
          className="truncate text-[13.5px] text-ink hover:underline"
        >
          {task.name}
        </Link>
      </div>

      <AssigneesPicker
        members={surface.members}
        value={task.assigneeIds}
        disabled={!surface.canEdit}
        onChange={(assigneeIds) => {
          surface.actions.patch.mutate({
            id: task.id,
            body: { assigneeIds },
            optimistic: { assigneeIds },
          });
        }}
      >
        <button
          type="button"
          className="hidden h-9 items-center justify-start rounded-lg px-1 hover:bg-surface-2 md:flex"
          aria-label={`Responsáveis de ${task.name}`}
        >
          <AssigneeStack ids={task.assigneeIds} members={surface.members} />
        </button>
      </AssigneesPicker>

      <DuePicker
        value={task.dueAt}
        disabled={!surface.canEdit}
        onChange={(dueAt) => {
          edit({ dueAt });
        }}
      >
        <button
          type="button"
          title={formatDueLong(task.dueAt)}
          aria-label={`Prazo de ${task.name}: ${formatDueLong(task.dueAt)}`}
          className={cn(
            'h-9 truncate rounded-lg px-1 text-right text-[12.5px] hover:bg-surface-2 md:text-left',
            DUE_TONE_CLASS[tone],
          )}
        >
          {formatDue(task.dueAt, task.dueHasTime)}
        </button>
      </DuePicker>

      <PriorityPicker
        value={task.priority}
        disabled={!surface.canEdit}
        onSelect={(priority) => {
          surface.actions.patch.mutate({
            id: task.id,
            body: { priority },
            optimistic: { priority },
          });
        }}
      >
        <button
          type="button"
          className="hidden h-9 items-center gap-1.5 rounded-lg px-1 hover:bg-surface-2 md:flex"
          aria-label={`Prioridade de ${task.name}`}
        >
          <PriorityFlag priority={task.priority} withLabel />
        </button>
      </PriorityPicker>
    </div>
  );
}

/** View Lista: grupos recolhíveis, edição por popover e arrasto para reordenar. */
export function ListView(surface: ViewSurfaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState<Task | null>(null);
  const grouped = surface.groupBy !== 'none';
  const rows = rowsOf(surface.groups, collapsed, grouped);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => ROW_SIZE[rows[index]?.kind ?? 'task'],
    overscan: 14,
  });

  const toggleGroup = (key: string): void => {
    setCollapsed((current) => {
      const next = new Set(current);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent): void => {
    setDragging(null);

    if (over) {
      surface.onDrop(String(active.id), String(over.id));
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={({ active }) => {
        setDragging(
          surface.groups.flatMap((group) => group.items).find((item) => item.id === active.id) ??
            null,
        );
      }}
      onDragCancel={() => {
        setDragging(null);
      }}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={surface.groups.flatMap((group) => group.items.map((item) => item.id))}
      >
        <div ref={scrollRef} className="min-w-0 flex-1 overflow-y-auto px-2 pb-10 md:px-4">
          <div className="relative" style={{ height: `${String(virtualizer.getTotalSize())}px` }}>
            {virtualizer.getVirtualItems().map((item) => {
              const row = rows[item.index];

              if (!row) {
                return null;
              }

              return (
                <div
                  key={item.key}
                  ref={virtualizer.measureElement}
                  data-index={item.index}
                  className="absolute left-0 top-0 w-full"
                  style={{ transform: `translateY(${String(item.start)}px)` }}
                >
                  {row.kind === 'group' ? (
                    <GroupHeader
                      group={row.group}
                      collapsed={collapsed.has(row.group.key)}
                      surface={surface}
                      onToggle={() => {
                        toggleGroup(row.group.key);
                      }}
                    />
                  ) : null}

                  {row.kind === 'columns' ? (
                    <div
                      className={cn(
                        GRID,
                        'border-b border-line pb-1.5 text-[11.5px] uppercase tracking-[0.06em] text-muted',
                      )}
                    >
                      <span className="sr-only">Seleção</span>
                      <span>Tarefa</span>
                      <span className="hidden md:block">Responsáveis</span>
                      <span className="text-right md:text-left">Prazo</span>
                      <span className="hidden md:block">Prioridade</span>
                    </div>
                  ) : null}

                  {row.kind === 'task' ? (
                    <TaskRow
                      task={row.task}
                      surface={surface}
                      selected={surface.selected.has(row.task.id)}
                    />
                  ) : null}

                  {row.kind === 'more' ? (
                    <div className="py-1">
                      <Button
                        variant="nav"
                        size="sm"
                        disabled={surface.loadingMore}
                        onClick={() => {
                          surface.onLoadMore(row.cursor);
                        }}
                      >
                        {surface.loadingMore ? <Spinner label="Carregando" /> : 'Carregar mais'}
                      </Button>
                    </div>
                  ) : null}

                  {row.kind === 'add' ? (
                    <QuickAdd
                      groupKey={grouped ? row.groupKey : null}
                      surface={surface}
                      label="+ Adicionar tarefa"
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        {dragging ? (
          <div className="rounded-lg border border-accent bg-surface px-3 py-2 text-[13px] text-ink shadow-xl">
            {dragging.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
