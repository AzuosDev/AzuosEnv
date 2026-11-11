import { useDraggable } from '@dnd-kit/core';
import { Link } from '@tanstack/react-router';
import { GripVertical } from 'lucide-react';
import type { PlannerTask } from '@/api/types';
import { Button } from '@/components/ui/button';
import { formatMinutes } from '@/features/tasks/time-fields';
import { cn } from '@/lib/utils';
import { taskBlockMinutes } from '../planner-model';

export interface UnscheduledPanelProps {
  wsId: string;
  tasks: PlannerTask[];
  /** Reserva o primeiro horário livre do recorte (time-blocking). */
  onSchedule: (task: PlannerTask) => void;
  canDrag: boolean;
}

export const TASK_DRAG_PREFIX = 'planner-task:';

export function taskDragId(taskId: string): string {
  return `${TASK_DRAG_PREFIX}${taskId}`;
}

export function taskOfDragId(id: string): string | null {
  return id.startsWith(TASK_DRAG_PREFIX) ? id.slice(TASK_DRAG_PREFIX.length) : null;
}

function TaskCard({
  wsId,
  task,
  onSchedule,
  canDrag,
}: {
  wsId: string;
  task: PlannerTask;
  onSchedule: (task: PlannerTask) => void;
  canDrag: boolean;
}) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: taskDragId(task.id),
    data: { taskId: task.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-line bg-surface p-3',
        isDragging && 'opacity-60',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {canDrag ? (
          <button
            type="button"
            aria-label={`Arrastar ${task.name} para a grade`}
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink md:flex"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
        <span className="min-w-0 text-[11.5px] text-muted">
          {task.customId} · {formatMinutes(taskBlockMinutes(task))}
        </span>
      </div>

      <Link
        to="/w/$wsId/t/$customId"
        params={{ wsId, customId: task.customId }}
        className="min-w-0 break-words text-[13px] font-medium text-ink no-underline hover:text-accent"
      >
        {task.name}
      </Link>

      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          onSchedule(task);
        }}
      >
        Agendar
      </Button>
    </div>
  );
}

/**
 * "Para agendar": tarefas minhas em aberto sem bloco de tempo. No ponteiro elas
 * são arrastadas para a grade; no toque o botão "Agendar" reserva o primeiro
 * horário livre.
 */
export function UnscheduledPanel({ wsId, tasks, onSchedule, canDrag }: UnscheduledPanelProps) {
  return (
    <section aria-label="Tarefas para agendar" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-ink">Para agendar</h2>
        <p className="text-[12.5px] text-muted">
          Tarefas suas sem horário. “Agendar” reserva o primeiro horário livre do período.
        </p>
      </div>

      {tasks.length === 0 ? (
        <p className="text-[13px] text-body">Tudo agendado neste período.</p>
      ) : (
        <ul className="flex min-w-0 flex-col gap-2">
          {tasks.map((task) => (
            <li key={task.id} className="min-w-0">
              <TaskCard wsId={wsId} task={task} onSchedule={onSchedule} canDrag={canDrag} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
