import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { ListNode, SprintFolderView } from '@/api/types';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/features/settings/components/confirm-dialog';
import { queryTasks } from '@/features/tasks/api';
import { flattenGroups } from '@/features/tasks/task-model';
import { cn } from '@/lib/utils';
import { closeSprint, createSprint } from '../api';
import {
  SPRINT_STATE_LABEL,
  leftovers,
  sprintPoints,
  sprintProgress,
  sprintRangeLabel,
  sprintState,
} from '../sprint-model';

export interface SprintStripProps {
  wsId: string;
  sprint: ListNode;
  folder: SprintFolderView;
  canEdit: boolean;
}

const STATE_CLASS: Record<string, string> = {
  current: 'bg-accent/[0.16] text-ink',
  future: 'bg-info/[0.16] text-ink',
  past: 'bg-warning/[0.16] text-ink',
  closed: 'bg-surface-2 text-muted',
};

/**
 * Faixa da sprint na página da List: período, pontos entregues e o botão que
 * fecha a sprint levando as pendências para a próxima.
 */
export function SprintStrip({ wsId, sprint, folder, canEdit }: SprintStripProps) {
  const client = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const params = { location: 'list' as const, locationId: sprint.id, limit: 100, showClosed: true };
  const tasks = useQuery({
    queryKey: queryKeys.tasks(wsId, { ...params, sprintStrip: true }),
    queryFn: () => queryTasks(wsId, params),
    staleTime: 15_000,
  });
  const items = tasks.data ? flattenGroups(tasks.data.groups ?? []) : [];
  const points = sprintPoints(items);
  const pending = leftovers(items).length;
  const state = sprintState(sprint);
  const range = sprintRangeLabel(sprint);
  const progress = sprintProgress(points);

  const close = useMutation({
    mutationFn: () => closeSprint(wsId, sprint.id),
    onSuccess: async (result) => {
      toast.success(
        result.moved === 0
          ? 'Sprint fechada sem pendências.'
          : `Sprint fechada: ${String(result.moved)} ${
              result.moved === 1 ? 'tarefa foi' : 'tarefas foram'
            } para ${result.nextSprint.name}.`,
      );
      setConfirmOpen(false);
      await client.invalidateQueries({ queryKey: ['workspaces', wsId] });
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  const next = useMutation({
    mutationFn: () => createSprint(wsId, folder.sprintFolder.id),
    onSuccess: async (created) => {
      toast.success(`${created.name} criada.`);
      await client.invalidateQueries({ queryKey: ['workspaces', wsId] });
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  return (
    <section
      aria-label={`Sprint ${sprint.name}`}
      className="mx-4 flex min-w-0 flex-col gap-2 rounded-xl border border-line bg-surface p-3 md:mx-6"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold',
            STATE_CLASS[state],
          )}
        >
          {SPRINT_STATE_LABEL[state]}
        </span>

        <span className="min-w-0 text-[13px] text-body">
          {folder.sprintFolder.name}
          {range ? ` · ${range}` : ''}
        </span>

        <span className="text-[13px] font-semibold text-ink">
          {points.total > 0
            ? `${String(points.done)} de ${String(points.total)} pontos`
            : `${String(points.tasksDone)} de ${String(points.tasks)} tarefas`}
        </span>

        {canEdit ? (
          <span className="ml-auto flex flex-wrap items-center gap-2">
            {sprint.sprintClosedAt ? null : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setConfirmOpen(true);
                }}
              >
                Fechar sprint
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={next.isPending}
              onClick={() => {
                next.mutate();
              }}
            >
              Criar próxima sprint
            </Button>
          </span>
        ) : null}
      </div>

      <div
        className="h-1.5 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progresso da sprint ${sprint.name}`}
      >
        <div className="h-1.5 rounded-full bg-accent" style={{ width: `${String(progress)}%` }} />
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Fechar a sprint?"
        description={
          pending === 0
            ? 'Nada ficou em aberto: a sprint só é marcada como fechada.'
            : `${String(pending)} ${
                pending === 1 ? 'tarefa em aberto vai' : 'tarefas em aberto vão'
              } para a próxima sprint, criada se ainda não existir.`
        }
        confirmLabel="Fechar sprint"
        pending={close.isPending}
        onConfirm={() => {
          close.mutate();
        }}
      />
    </section>
  );
}
