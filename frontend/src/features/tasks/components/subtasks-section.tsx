import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { EffectiveStatus, Task, WorkspaceMemberItem } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { StatusPill } from '@/components/ui/status-pill';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { createTask, moveTask, subtasksQuery, updateTask } from '../api';
import { DUE_TONE_CLASS, dueTone, formatDue, statusTone } from '../task-fields';
import { AssigneeStack } from './assignee-stack';
import { AssigneesPicker, DuePicker, StatusPicker } from './task-pickers';

export interface SubtasksSectionProps {
  wsId: string;
  /** Tarefa pai: a subtarefa nasce na mesma List dela. */
  parentId: string;
  parentCustomId: string;
  listId: string;
  statuses: EffectiveStatus[];
  members: WorkspaceMemberItem[];
  onChanged: () => void;
}

/** Para onde a subtarefa vai quando sobe ou desce uma casa. */
export function neighbours(
  items: Task[],
  id: string,
  direction: -1 | 1,
): { previousId?: string; nextId?: string } | null {
  const index = items.findIndex((item) => item.id === id);
  const target = index + direction;

  if (index < 0 || target < 0 || target >= items.length) {
    return null;
  }

  if (direction === -1) {
    const before = items[target - 1]?.id;

    return { ...(before ? { previousId: before } : {}), nextId: items[target]?.id ?? '' };
  }

  const after = items[target + 1]?.id;

  return { previousId: items[target]?.id ?? '', ...(after ? { nextId: after } : {}) };
}

/**
 * Subtarefas diretas: status, responsáveis e prazo em cada linha, criação
 * inline, reordenação e link para abrir a subtarefa no painel.
 */
export function SubtasksSection({
  wsId,
  parentId,
  parentCustomId,
  listId,
  statuses,
  members,
  onChanged,
}: SubtasksSectionProps) {
  const queryClient = useQueryClient();
  const subtasks = useQuery(subtasksQuery(wsId, parentCustomId));
  const [draft, setDraft] = useState('');
  const items = subtasks.data ?? [];

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.subtasks(wsId, parentCustomId) });
    onChanged();
  };

  const onError = (error: unknown): void => {
    toast.error(errorMessage(error));
  };

  const create = useMutation({
    mutationFn: (name: string) => createTask(wsId, listId, { name, parentTaskId: parentId }),
    onSuccess: () => {
      setDraft('');
      refresh();
    },
    onError,
  });

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updateTask>[2] }) =>
      updateTask(wsId, id, body),
    onSuccess: refresh,
    onError,
  });

  const reorder = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: -1 | 1 }) => {
      const plan = neighbours(items, id, direction);

      if (!plan) {
        return Promise.resolve(null);
      }

      return moveTask(wsId, id, { listId, ...plan });
    },
    onSuccess: refresh,
    onError,
  });

  const done = items.filter(
    (item) => item.statusGroup === 'done' || item.statusGroup === 'closed',
  ).length;

  return (
    <section aria-labelledby="task-subtasks-heading" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="task-subtasks-heading" className="text-[12.5px] font-semibold text-muted">
          Subtarefas
        </h2>
        {items.length > 0 ? (
          <span className="text-[12px] text-muted">
            {done} de {items.length}
          </span>
        ) : null}
      </div>

      {subtasks.isPending ? <Spinner label="Carregando as subtarefas" /> : null}

      <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface">
        {items.length === 0 && !subtasks.isPending ? (
          <li className="px-3 py-2.5 text-[12.5px] text-muted">Nenhuma subtarefa ainda.</li>
        ) : null}

        {items.map((item, index) => {
          const status = statuses.find((option) => option.id === item.statusId);

          return (
            <li key={item.id} className="flex flex-wrap items-center gap-2 px-2 py-2">
              <StatusPicker
                statuses={statuses}
                value={item.statusId}
                onSelect={(statusId) => {
                  patch.mutate({ id: item.id, body: { statusId } });
                }}
              >
                <button type="button" aria-label={`Status de ${item.name}`} className="shrink-0">
                  <StatusPill tone={statusTone(item.statusGroup, status?.color)}>
                    {status?.name ?? 'Status'}
                  </StatusPill>
                </button>
              </StatusPicker>

              <Link
                to="/w/$wsId/t/$customId"
                params={{ wsId, customId: item.customId }}
                className="min-w-0 flex-1 truncate text-[13px] text-ink hover:underline"
              >
                {item.name}
              </Link>

              <AssigneesPicker
                members={members}
                value={item.assigneeIds}
                align="end"
                onChange={(assigneeIds) => {
                  patch.mutate({ id: item.id, body: { assigneeIds } });
                }}
              >
                <button
                  type="button"
                  aria-label={`Responsáveis de ${item.name}`}
                  className="shrink-0 rounded-lg px-1 py-1 hover:bg-surface-2"
                >
                  <AssigneeStack ids={item.assigneeIds} members={members} max={2} />
                </button>
              </AssigneesPicker>

              <DuePicker
                value={item.dueAt}
                align="end"
                onChange={(dueAt) => {
                  patch.mutate({ id: item.id, body: { dueAt } });
                }}
              >
                <button
                  type="button"
                  aria-label={`Prazo de ${item.name}`}
                  className={cn(
                    'shrink-0 rounded-lg px-1.5 py-1 text-[12.5px] hover:bg-surface-2',
                    DUE_TONE_CLASS[dueTone(item.dueAt)],
                  )}
                >
                  {formatDue(item.dueAt, item.dueHasTime)}
                </button>
              </DuePicker>

              <span className="flex shrink-0">
                <Button
                  variant="nav"
                  size="icon"
                  aria-label={`Mover ${item.name} para cima`}
                  disabled={index === 0 || reorder.isPending}
                  className="h-8 w-8"
                  onClick={() => {
                    reorder.mutate({ id: item.id, direction: -1 });
                  }}
                >
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="nav"
                  size="icon"
                  aria-label={`Mover ${item.name} para baixo`}
                  disabled={index === items.length - 1 || reorder.isPending}
                  className="h-8 w-8"
                  onClick={() => {
                    reorder.mutate({ id: item.id, direction: 1 });
                  }}
                >
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </Button>
              </span>
            </li>
          );
        })}
      </ul>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();

          const name = draft.trim();

          if (name !== '') {
            create.mutate(name);
          }
        }}
      >
        <Input
          aria-label="Nova subtarefa"
          placeholder="Nova subtarefa"
          value={draft}
          className="h-10"
          onChange={(event) => {
            setDraft(event.target.value);
          }}
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Criar subtarefa"
          disabled={draft.trim() === '' || create.isPending}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>
    </section>
  );
}
