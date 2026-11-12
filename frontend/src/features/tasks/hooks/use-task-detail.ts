import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { Checklist, TaskDetail, UpdateTaskInput } from '@/api/types';
import { toast } from '@/components/ui/toast';
import { updateTask } from '../api';
import { replaceChecklist } from '../checklist-model';

export interface TaskDetailActions {
  /** Escreve um campo da tarefa, pintando o painel antes da resposta. */
  patch: (body: UpdateTaskInput, optimistic?: Partial<TaskDetail>) => Promise<void>;
  /** Troca uma checklist no cache do painel (toda escrita devolve a inteira). */
  setChecklist: (checklist: Checklist) => void;
  /** Tira a checklist do cache depois do DELETE. */
  dropChecklist: (checklistId: string) => void;
  /** Refaz o painel e as listas que mostram a tarefa. */
  refresh: () => void;
  saving: boolean;
}

/**
 * Escritas do painel da tarefa. O painel é a fonte da verdade na tela: cada
 * patch pinta o cache do detalhe na hora, volta atrás no erro e, no fim,
 * invalida as consultas das views para a Lista e o Quadro acompanharem.
 */
export function useTaskDetailActions(wsId: string, customId: string): TaskDetailActions {
  const queryClient = useQueryClient();
  const detailKey = queryKeys.task(wsId, customId);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['workspaces', wsId, 'tasks'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.tree(wsId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.inboxCounts(wsId) });
  }, [queryClient, wsId]);

  const paint = useCallback(
    (change: (detail: TaskDetail) => TaskDetail): TaskDetail | undefined => {
      const snapshot = queryClient.getQueryData<TaskDetail>(detailKey);

      queryClient.setQueryData<TaskDetail>(detailKey, (data) => (data ? change(data) : data));

      return snapshot;
    },
    [queryClient, detailKey],
  );

  const mutation = useMutation({
    mutationFn: ({ body }: { body: UpdateTaskInput; optimistic?: Partial<TaskDetail> }) =>
      updateTask(wsId, customId, body),
    onMutate: ({ body, optimistic }) =>
      paint((detail) => ({ ...detail, ...(optimistic ?? (body as Partial<TaskDetail>)) })),
    onError: (error, _variables, snapshot) => {
      if (snapshot) {
        queryClient.setQueryData(detailKey, snapshot);
      }

      toast.error(errorMessage(error));
    },
    onSuccess: (task) => {
      queryClient.setQueryData<TaskDetail>(detailKey, (detail) =>
        detail ? { ...detail, ...task } : detail,
      );
      refresh();
    },
  });

  const patch = useCallback(
    async (body: UpdateTaskInput, optimistic?: Partial<TaskDetail>): Promise<void> => {
      try {
        await mutation.mutateAsync({ body, optimistic });
      } catch {
        // O toast e o rollback já saíram no onError.
      }
    },
    [mutation],
  );

  const setChecklist = useCallback(
    (checklist: Checklist) => {
      paint((detail) => ({
        ...detail,
        checklists: replaceChecklist(detail.checklists as Checklist[], checklist),
      }));
    },
    [paint],
  );

  const dropChecklist = useCallback(
    (checklistId: string) => {
      paint((detail) => ({
        ...detail,
        checklists: (detail.checklists as Checklist[]).filter(
          (checklist) => checklist.id !== checklistId,
        ),
      }));
    },
    [paint],
  );

  return { patch, setChecklist, dropChecklist, refresh, saving: mutation.isPending };
}
