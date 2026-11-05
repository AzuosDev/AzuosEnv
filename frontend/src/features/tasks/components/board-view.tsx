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
import { Link } from '@tanstack/react-router';
import { CheckSquare, GripVertical } from 'lucide-react';
import { useState } from 'react';
import type { Task } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PriorityFlag } from '@/components/ui/priority-flag';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { DUE_TONE_CLASS, dueTone, formatDue, formatDueLong } from '../task-fields';
import { groupDropId, type TaskGroupState } from '../task-model';
import { AssigneeStack } from './assignee-stack';
import { QuickAdd } from './quick-add';
import type { ViewSurfaceProps } from './view-surface';

const collision: CollisionDetection = (args) => {
  const found = pointerWithin(args);

  return found.length > 0 ? found : closestCenter(args);
};

function Card({
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
  const tone = dueTone(task.dueAt);

  return (
    <article
      ref={sortable.setNodeRef}
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-line bg-surface p-3',
        selected && 'border-accent',
        sortable.isOver && !sortable.isDragging && 'ring-1 ring-accent',
        sortable.isDragging && 'opacity-40',
      )}
    >
      <div className="flex items-center gap-2">
        <Checkbox
          checked={selected}
          aria-label={`Selecionar ${task.name}`}
          onCheckedChange={() => {
            surface.onToggleSelect(task.id);
          }}
        />
        <span className="text-[11.5px] text-muted">{task.customId}</span>
        <span className="flex-1" />
        {surface.canEdit ? (
          <button
            type="button"
            aria-label={`Arrastar ${task.name}`}
            className="hidden h-7 w-5 cursor-grab items-center justify-center text-muted hover:text-ink md:flex"
            {...sortable.attributes}
            {...sortable.listeners}
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <Link
        to="/w/$wsId/t/$customId"
        params={{ wsId: surface.wsId, customId: task.customId }}
        className="text-[13.5px] font-medium leading-snug text-ink hover:underline"
      >
        {task.name}
      </Link>

      <div className="flex items-center gap-2.5 text-[12px]">
        <AssigneeStack ids={task.assigneeIds} members={surface.members} max={2} />
        <span className={DUE_TONE_CLASS[tone]} title={formatDueLong(task.dueAt)}>
          {formatDue(task.dueAt, task.dueHasTime)}
        </span>
        {task.subtaskCount > 0 ? (
          <span className="flex items-center gap-1 text-muted">
            <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {task.subtaskDoneCount}/{task.subtaskCount}
              <span className="sr-only"> subtarefas concluídas</span>
            </span>
          </span>
        ) : null}
        <span className="flex-1" />
        <PriorityFlag priority={task.priority} />
      </div>
    </article>
  );
}

function Column({ group, surface }: { group: TaskGroupState; surface: ViewSurfaceProps }) {
  const { setNodeRef, isOver } = useDroppable({ id: groupDropId(group.key) });
  const status = surface.statuses.find((item) => item.id === group.key);

  return (
    <section
      ref={setNodeRef}
      aria-label={group.label}
      className={cn(
        'relative flex w-[85vw] shrink-0 snap-start flex-col gap-2 rounded-2xl bg-surface-2 p-2.5 sm:w-[272px]',
        isOver && 'ring-1 ring-accent',
      )}
    >
      <header className="flex items-center gap-2 px-1 pb-1">
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            status?.group === 'done' || status?.group === 'closed'
              ? 'bg-success'
              : status?.group === 'active'
                ? 'bg-info'
                : 'bg-muted',
          )}
          aria-hidden="true"
        />
        <h3 className="flex-1 truncate text-[13px] font-semibold text-ink">{group.label}</h3>
        <span className="text-[12px] text-muted">{group.items.length}</span>
      </header>

      <SortableContext items={group.items.map((item) => item.id)}>
        <div className="flex flex-col gap-2">
          {group.items.map((task) => (
            <Card
              key={task.id}
              task={task}
              surface={surface}
              selected={surface.selected.has(task.id)}
            />
          ))}
        </div>
      </SortableContext>

      {group.nextCursor ? (
        <Button
          variant="nav"
          size="sm"
          disabled={surface.loadingMore}
          onClick={() => {
            surface.onLoadMore(group.nextCursor ?? '');
          }}
        >
          {surface.loadingMore ? <Spinner label="Carregando" /> : 'Carregar mais'}
        </Button>
      ) : null}

      <QuickAdd
        groupKey={surface.groupBy === 'none' ? null : group.key}
        surface={surface}
        label="+ Adicionar"
        className="rounded-lg border border-dashed border-line"
      />
    </section>
  );
}

/**
 * View Quadro: uma coluna por grupo, arrasto entre colunas e, no celular,
 * rolagem horizontal com snap e coluna de 85% da tela.
 */
export function BoardView(surface: ViewSurfaceProps) {
  const [dragging, setDragging] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
      <div className="min-w-0 flex-1 overflow-auto px-3 pb-10 md:px-6">
        <div className="flex snap-x snap-mandatory items-start gap-3 sm:snap-none">
          {surface.groups.map((group) => (
            <Column key={group.key} group={group} surface={surface} />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging ? (
          <div className="rounded-xl border border-accent bg-surface px-3 py-2 text-[13px] text-ink shadow-xl">
            {dragging.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
