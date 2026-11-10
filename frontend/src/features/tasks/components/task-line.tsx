import { Link } from '@tanstack/react-router';
import type { EffectiveStatus, Task, UpdateTaskInput, WorkspaceMemberItem } from '@/api/types';
import { PriorityFlag } from '@/components/ui/priority-flag';
import { StatusPill } from '@/components/ui/status-pill';
import { cn } from '@/lib/utils';
import { DUE_TONE_CLASS, dueTone, formatDue, formatDueLong, statusTone } from '../task-fields';
import { AssigneeStack } from './assignee-stack';
import { AssigneesPicker, DuePicker, PriorityPicker, StatusPicker } from './task-pickers';

/** Grade da linha: as mesmas faixas da Lista, para a leitura em coluna. */
const GRID = 'grid min-h-12 items-center gap-3 border-b border-line px-3 py-2 last:border-b-0';

/** Celular: ponto, id, nome e prazo. */
const NARROW_COLUMNS = 'grid-cols-[10px_auto_minmax(0,1fr)_72px]';

/** 768: entram status, responsáveis e prioridade; o nome nunca encolhe demais. */
const MEDIUM_COLUMNS =
  'md:grid-cols-[10px_auto_minmax(120px,1fr)_minmax(0,124px)_minmax(0,max-content)_minmax(0,max-content)_72px]';

/** 1280: só aí sobra largura para a List de onde a tarefa vem. */
const WIDE_COLUMNS =
  'xl:grid-cols-[10px_auto_minmax(180px,1fr)_minmax(0,144px)_minmax(0,160px)_minmax(0,max-content)_minmax(0,max-content)_72px]';

export interface TaskLineProps {
  wsId: string;
  task: Task;
  /** Statuses efetivos da List da tarefa; vazio deixa o status só leitura. */
  statuses: EffectiveStatus[];
  members: WorkspaceMemberItem[];
  /** Nome da List, para situar a tarefa fora do contexto dela. */
  listName?: string;
  canEdit: boolean;
  onPatch: (body: UpdateTaskInput, optimistic?: Partial<Task>) => void;
}

/**
 * A linha de tarefa da Lista, fora de uma view: usada onde as tarefas vêm de
 * várias Lists (Minhas tarefas). Mesma ordem de informação e mesmos popovers.
 */
export function TaskLine({
  wsId,
  task,
  statuses,
  members,
  listName,
  canEdit,
  onPatch,
}: TaskLineProps) {
  const status = statuses.find((item) => item.id === task.statusId);
  const tone = dueTone(task.dueAt);
  const editable = canEdit && statuses.length > 0;

  return (
    <li className={cn(GRID, NARROW_COLUMNS, MEDIUM_COLUMNS, WIDE_COLUMNS)}>
      <StatusPicker
        statuses={statuses}
        value={task.statusId}
        disabled={!editable}
        onSelect={(statusId) => {
          const picked = statuses.find((item) => item.id === statusId);

          onPatch({ statusId }, picked ? { statusId, statusGroup: picked.group } : undefined);
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
              task.statusGroup === 'done' || task.statusGroup === 'closed'
                ? 'bg-success'
                : task.statusGroup === 'active'
                  ? 'bg-info'
                  : 'bg-muted',
            )}
          />
        </button>
      </StatusPicker>

      <span className="shrink-0 text-[12px] text-muted">{task.customId}</span>

      <Link
        to="/w/$wsId/t/$customId"
        params={{ wsId, customId: task.customId }}
        className="min-w-0 truncate text-[13.5px] text-ink hover:underline"
      >
        {task.name}
      </Link>

      <span className="hidden min-w-0 md:block">
        {status ? (
          <StatusPill
            tone={statusTone(status.group, status.color)}
            className="block max-w-full truncate text-center"
          >
            {status.name}
          </StatusPill>
        ) : null}
      </span>

      <span className="hidden min-w-0 truncate text-[12px] text-muted xl:block">
        {listName ?? ''}
      </span>

      <AssigneesPicker
        members={members}
        value={task.assigneeIds}
        disabled={!canEdit}
        onChange={(assigneeIds) => {
          onPatch({ assigneeIds }, { assigneeIds });
        }}
      >
        <button
          type="button"
          className="hidden h-9 min-w-0 items-center rounded-lg px-1 hover:bg-surface-2 md:flex"
          aria-label={`Responsáveis de ${task.name}`}
        >
          <AssigneeStack ids={task.assigneeIds} members={members} max={2} />
        </button>
      </AssigneesPicker>

      <PriorityPicker
        value={task.priority}
        disabled={!canEdit}
        onSelect={(priority) => {
          onPatch({ priority }, { priority });
        }}
      >
        <button
          type="button"
          className="hidden h-9 items-center gap-1.5 rounded-lg px-1 hover:bg-surface-2 md:flex"
          aria-label={`Prioridade de ${task.name}`}
        >
          <PriorityFlag priority={task.priority} />
        </button>
      </PriorityPicker>

      <DuePicker
        value={task.dueAt}
        disabled={!canEdit}
        onChange={(dueAt) => {
          onPatch({ dueAt });
        }}
      >
        <button
          type="button"
          title={formatDueLong(task.dueAt)}
          aria-label={`Prazo de ${task.name}: ${formatDueLong(task.dueAt)}`}
          className={cn(
            'h-9 min-w-0 truncate rounded-lg px-1 text-right text-[12.5px] hover:bg-surface-2',
            DUE_TONE_CLASS[tone],
          )}
        >
          {formatDue(task.dueAt, task.dueHasTime)}
        </button>
      </DuePicker>
    </li>
  );
}
