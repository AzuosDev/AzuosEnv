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
import { useEffect, useRef, useState } from 'react';
import type { CustomField, Task } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PriorityFlag } from '@/components/ui/priority-flag';
import { Spinner } from '@/components/ui/spinner';
import { StatusPill } from '@/components/ui/status-pill';
import { cn } from '@/lib/utils';
import { fieldValueOf, formatFieldValue } from '../field-values';
import { listLayout, type ListLayout } from '../list-layout';
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

/** A grade do cabeçalho e das linhas; as faixas vêm do layout do container. */
const GRID = 'grid items-center gap-2 px-2 md:gap-3 md:px-3';

/** Grade estreita: caixa de seleção, nome e prazo. */
const NARROW_GRID = 'grid-cols-[28px_minmax(0,1fr)_72px]';

/** Largura do elemento, observada de verdade, para a grade acompanhar. */
function useWidth(ref: { current: HTMLElement | null }): number {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0]?.contentRect.width ?? 0);
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return width;
}

/** Valor do campo na linha da tarefa, em texto. */
function FieldCells({ task, fields }: { task: Task; fields: CustomField[] }) {
  return (
    <>
      {fields.map((field) => {
        const text = formatFieldValue(field, fieldValueOf(task.customFields, field.id));

        return (
          <span key={field.id} title={text} className="min-w-0 truncate text-[12.5px] text-body">
            {text === '' ? <span className="text-muted">—</span> : text}
          </span>
        );
      })}
    </>
  );
}

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
  layout,
}: {
  task: Task;
  surface: ViewSurfaceProps;
  selected: boolean;
  layout: ListLayout;
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
      style={layout.style}
      className={cn(
        GRID,
        !layout.wide && NARROW_GRID,
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

      <FieldCells task={task} fields={layout.fields} />

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
          className={cn(
            'h-9 items-center justify-start rounded-lg px-1 hover:bg-surface-2',
            layout.wide ? 'flex' : 'hidden',
          )}
        >
          <AssigneeStack ids={task.assigneeIds} members={surface.members} />
          <span className="sr-only">{`Responsáveis de ${task.name}`}</span>
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
          className={cn(
            'h-9 truncate rounded-lg px-1 text-right text-[12.5px] hover:bg-surface-2 md:text-left',
            DUE_TONE_CLASS[tone],
          )}
        >
          {formatDue(task.dueAt, task.dueHasTime)}
          <span className="sr-only">{`— prazo de ${task.name}: ${formatDueLong(task.dueAt)}`}</span>
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
          className={cn(
            'h-9 items-center gap-1.5 rounded-lg px-1 hover:bg-surface-2',
            layout.wide ? 'flex' : 'hidden',
          )}
        >
          <PriorityFlag priority={task.priority} withLabel />
          <span className="sr-only">{`Prioridade de ${task.name}`}</span>
        </button>
      </PriorityPicker>
    </div>
  );
}

/** View Lista: grupos recolhíveis, edição por popover e arrasto para reordenar. */
export function ListView(surface: ViewSurfaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const layout = listLayout(useWidth(scrollRef), surface.fieldColumns);
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
                      style={layout.style}
                      className={cn(
                        GRID,
                        !layout.wide && NARROW_GRID,
                        'border-b border-line pb-1.5 text-[11.5px] uppercase tracking-[0.06em] text-muted',
                      )}
                    >
                      <span>
                        <span className="sr-only">Seleção</span>
                      </span>
                      <span className="min-w-0 truncate">Tarefa</span>
                      {layout.fields.map((field) => (
                        <span key={field.id} className="min-w-0 truncate">
                          {field.name}
                        </span>
                      ))}
                      {layout.wide ? <span className="min-w-0 truncate">Responsáveis</span> : null}
                      <span className={cn('min-w-0 truncate', !layout.wide && 'text-right')}>
                        Prazo
                      </span>
                      {layout.wide ? <span className="min-w-0 truncate">Prioridade</span> : null}
                    </div>
                  ) : null}

                  {row.kind === 'task' ? (
                    <TaskRow
                      task={row.task}
                      surface={surface}
                      layout={layout}
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
