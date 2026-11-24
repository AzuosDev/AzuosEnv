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
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { Link } from '@tanstack/react-router';
import { Check, CheckSquare, GripVertical, MoreHorizontal, Plus, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import type { Task } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PriorityFlag } from '@/components/ui/priority-flag';
import { Spinner } from '@/components/ui/spinner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  const droppable = useDroppable({ id: groupDropId(group.key) });
  const sortable = useSortable({ id: `column:${group.key}`, disabled: !surface.canManageColumns });
  const status = surface.statuses.find((item) => item.id === group.key);
  const selectedCount = group.items.filter((task) => surface.selected.has(task.id)).length;
  const selected =
    group.items.length > 0 && selectedCount === group.items.length
      ? true
      : selectedCount > 0
        ? 'indeterminate'
        : false;

  return (
    <section
      ref={(node) => {
        droppable.setNodeRef(node);
        sortable.setNodeRef(node);
      }}
      style={{
        transform: sortable.transform
          ? `translate3d(${sortable.transform.x}px, ${sortable.transform.y}px, 0)`
          : undefined,
        transition: sortable.transition,
      }}
      aria-label={group.label}
      className={cn(
        'relative flex w-[85vw] shrink-0 snap-start flex-col gap-2 rounded-2xl bg-surface-2 p-2.5 sm:w-[272px]',
        droppable.isOver && 'ring-1 ring-accent',
        sortable.isDragging && 'z-10 opacity-50',
      )}
    >
      <header className="flex items-center gap-2 px-1 pb-1">
        <Checkbox
          checked={selected}
          disabled={!surface.canEdit || group.items.length === 0}
          aria-label={`Selecionar tarefas da coluna ${group.label}`}
          onCheckedChange={() => {
            surface.onToggleGroupSelect(group.items.map((task) => task.id));
          }}
        />
        {surface.canManageColumns ? (
          <button
            type="button"
            aria-label={`Mover coluna ${group.label}`}
            className="flex h-7 w-5 cursor-grab items-center justify-center text-muted hover:text-ink"
            {...sortable.attributes}
            {...sortable.listeners}
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
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
        {surface.canManageColumns ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="nav"
                size="icon"
                className="h-8 w-8"
                aria-label={`Opções da coluna ${group.label}`}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => surface.onManageColumns({ focusStatusId: group.key })}
              >
                <Settings2 className="h-4 w-4" aria-hidden="true" />
                Editar coluna
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
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
  const [draggingColumn, setDraggingColumn] = useState<string | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [creatingColumn, setCreatingColumn] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent): void => {
    setDragging(null);
    setDraggingColumn(null);

    if (String(active.id).startsWith('column:') && over) {
      const target = surface.groups.find(
        (group) =>
          group.items.some((task) => task.id === String(over.id)) ||
          groupDropId(group.key) === String(over.id) ||
          `column:${group.key}` === String(over.id),
      );
      if (target) surface.onReorderColumns(String(active.id), `column:${target.key}`);
    } else if (over) {
      const overId = String(over.id);
      const columnKey = overId.startsWith('column:') ? overId.slice('column:'.length) : null;
      surface.onDrop(String(active.id), columnKey ? groupDropId(columnKey) : overId);
    }
  };

  const createColumn = async (): Promise<void> => {
    const name = newColumnName.trim();
    if (!name || creatingColumn) return;
    setCreatingColumn(true);
    try {
      const created = await surface.onCreateColumn(name);
      if (created) {
        setNewColumnName('');
        setAddingColumn(false);
      }
    } finally {
      setCreatingColumn(false);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={({ active }) => {
        if (String(active.id).startsWith('column:')) {
          setDraggingColumn(String(active.id).slice('column:'.length));
          return;
        }
        setDragging(
          surface.groups.flatMap((group) => group.items).find((item) => item.id === active.id) ??
            null,
        );
      }}
      onDragCancel={() => {
        setDragging(null);
        setDraggingColumn(null);
      }}
      onDragEnd={onDragEnd}
    >
      <div className="min-w-0 flex-1 overflow-auto px-3 pb-10 md:px-6">
        <SortableContext
          items={surface.groups.map((group) => `column:${group.key}`)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex snap-x snap-mandatory items-start gap-3 sm:snap-none">
            {surface.groups.map((group) => (
              <Column key={group.key} group={group} surface={surface} />
            ))}
            {surface.canManageColumns ? (
              <div className="w-[248px] shrink-0 pt-2">
                {addingColumn ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void createColumn();
                    }}
                    className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-2 py-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25"
                  >
                    <span className="h-4 w-4 shrink-0 rounded-full bg-success" aria-hidden="true" />
                    <Input
                      autoFocus
                      aria-label="Nome da nova coluna"
                      placeholder="Nome do status"
                      value={newColumnName}
                      disabled={creatingColumn}
                      onChange={(event) => setNewColumnName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          setAddingColumn(false);
                          setNewColumnName('');
                        }
                      }}
                      className="h-7 min-w-0 flex-1 border-0 bg-transparent px-0 text-[13px] focus-visible:ring-0 md:h-7"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Criar coluna"
                      disabled={!newColumnName.trim() || creatingColumn}
                      onClick={() => void createColumn()}
                      className="h-7 w-7 shrink-0 rounded-md"
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-muted hover:bg-surface-2 hover:text-ink"
                    onClick={() => setAddingColumn(true)}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Adicionar grupo
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </SortableContext>
      </div>

      <DragOverlay dropAnimation={null}>
        {draggingColumn ? (
          <div className="rounded-xl border border-accent bg-surface-2 px-3 py-2 text-[13px] font-semibold text-ink shadow-xl">
            {surface.groups.find((group) => group.key === draggingColumn)?.label}
          </div>
        ) : dragging ? (
          <div className="rounded-xl border border-accent bg-surface px-3 py-2 text-[13px] text-ink shadow-xl">
            {dragging.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
