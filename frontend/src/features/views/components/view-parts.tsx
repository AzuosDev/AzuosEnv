import { useDraggable } from '@dnd-kit/core';
import { Link } from '@tanstack/react-router';
import { GripVertical } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Task } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { statusTone } from '@/features/tasks/task-fields';
import type { ViewSurfaceProps } from '@/features/tasks/components/view-surface';
import { cn } from '@/lib/utils';

/** Cor do ponto do status, pelo grupo e pela cor escolhida. */
const DOT_CLASS: Record<string, string> = {
  success: 'bg-success',
  info: 'bg-info',
  warning: 'bg-warning',
  danger: 'bg-danger',
  accent: 'bg-accent',
  neutral: 'bg-muted',
};

export function statusDotClass(surface: ViewSurfaceProps, task: Task): string {
  const status = surface.statuses.find((item) => item.id === task.statusId);

  if (!status) {
    return 'bg-muted';
  }

  return DOT_CLASS[statusTone(status.group, status.color)] ?? 'bg-muted';
}

export function statusNameOf(surface: ViewSurfaceProps, task: Task): string {
  return surface.statuses.find((item) => item.id === task.statusId)?.name ?? 'sem status';
}

export interface TaskChipProps {
  task: Task;
  surface: ViewSurfaceProps;
  /** Arrastar só existe quando a view suporta e o papel permite. */
  draggable?: boolean;
  className?: string;
}

/**
 * Tarefa como etiqueta curta: usada no Calendário e no Workload, onde a célula
 * é pequena. A alça de arrastar fica só no ponteiro (md+); no toque e no teclado
 * o caminho é abrir a tarefa e mudar o campo no painel.
 */
export function TaskChip({ task, surface, draggable = false, className }: TaskChipProps) {
  const drag = useDraggable({ id: task.id, disabled: !draggable });

  return (
    <div
      ref={drag.setNodeRef}
      className={cn(
        'flex min-h-11 items-center gap-1.5 rounded-lg bg-surface-2 px-1.5 text-[12px] md:min-h-7',
        drag.isDragging && 'opacity-40',
        className,
      )}
    >
      {draggable ? (
        <button
          type="button"
          aria-label={`Arrastar ${task.name}`}
          className="hidden h-6 w-3.5 shrink-0 cursor-grab items-center justify-center text-muted hover:text-ink md:flex"
          {...drag.attributes}
          {...drag.listeners}
        >
          <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}

      <span
        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', statusDotClass(surface, task))}
        aria-hidden="true"
      />

      <Link
        to="/w/$wsId/t/$customId"
        params={{ wsId: surface.wsId, customId: task.customId }}
        title={`${task.customId} · ${task.name}`}
        className="min-w-0 flex-1 truncate text-ink hover:underline"
      >
        {task.name}
      </Link>
    </div>
  );
}

/**
 * "Carregar mais" das views sem agrupamento visível: o cursor é por grupo, então
 * aparece um botão por grupo que ainda tem página.
 */
export function LoadMoreBar({ surface }: { surface: ViewSurfaceProps }) {
  const pending = surface.groups.filter((group) => group.nextCursor !== null);

  if (pending.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-3 md:px-6">
      {pending.map((group) => (
        <Button
          key={group.key}
          variant="nav"
          size="sm"
          disabled={surface.loadingMore}
          onClick={() => {
            surface.onLoadMore(group.nextCursor ?? '');
          }}
        >
          {surface.loadingMore ? (
            <Spinner label="Carregando" />
          ) : (
            `Carregar mais${surface.groups.length > 1 ? ` · ${group.label}` : ''}`
          )}
        </Button>
      ))}
    </div>
  );
}

/** Container que rola só por dentro: a página nunca rola para os lados. */
export function ScrollArea({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div
      // tabIndex deixa o container rolável alcançável pelo teclado.
      tabIndex={0}
      role="region"
      aria-label={label}
      className={cn('min-w-0 max-w-full overflow-auto', className)}
    >
      {children}
    </div>
  );
}
