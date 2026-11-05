import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { BulkChanges, CreateTaskInput, Task, UpdateTaskInput, ViewGroupBy } from '@/api/types';
import { toast } from '@/components/ui/toast';
import { bulkTasks, createTask, deleteTask, moveTask, updateTask } from '../api';
import {
  moveTaskInPages,
  patchTaskInPages,
  patchTasksInPages,
  removeTasksFromPages,
  type TaskPages,
} from '../task-cache';
import { groupPatch } from '../task-fields';
import type { TaskDropPlan } from '../task-model';

export interface TaskActionsOptions {
  wsId: string;
  /** List aberta: destino de toda criação e da reordenação. */
  listId: string;
  /** Chave da consulta que a view está mostrando. */
  queryKey: readonly unknown[];
  groupBy: ViewGroupBy;
}

interface PatchVariables {
  id: string;
  body: UpdateTaskInput;
  /** O que a linha mostra antes da resposta chegar. */
  optimistic?: Partial<Task>;
}

interface BulkVariables {
  ids: string[];
  changes: BulkChanges;
  optimistic?: (task: Task) => Partial<Task>;
}

/**
 * Escritas da Lista e do Quadro: cada uma pinta o cache na hora e desfaz se a
 * API recusar. Depois do sucesso a consulta é invalidada para valer a verdade
 * do servidor.
 */
export function useTaskActions({ wsId, listId, queryKey, groupBy }: TaskActionsOptions) {
  const queryClient = useQueryClient();

  const paint = useCallback(
    (change: (data: TaskPages) => TaskPages): TaskPages | undefined => {
      const snapshot = queryClient.getQueryData<TaskPages>(queryKey);

      queryClient.setQueryData<TaskPages>(queryKey, (data) => (data ? change(data) : data));

      return snapshot;
    },
    [queryClient, queryKey],
  );

  const rollback = useCallback(
    (snapshot: TaskPages | undefined, error: unknown) => {
      if (snapshot) {
        queryClient.setQueryData(queryKey, snapshot);
      }

      toast.error(errorMessage(error));
    },
    [queryClient, queryKey],
  );

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey });
    void queryClient.invalidateQueries({ queryKey: queryKeys.tree(wsId) });
  }, [queryClient, queryKey, wsId]);

  const patch = useMutation({
    mutationFn: ({ id, body }: PatchVariables) => updateTask(wsId, id, body),
    onMutate: ({ id, body, optimistic }: PatchVariables) =>
      paint((data) => patchTaskInPages(data, id, optimistic ?? (body as Partial<Task>))),
    onError: (error, _variables, snapshot) => {
      rollback(snapshot, error);
    },
    onSuccess: refresh,
  });

  const move = useMutation({
    mutationFn: async ({ plan }: { plan: TaskDropPlan }) => {
      const change =
        plan.groupKey === plan.fromGroupKey ? null : groupPatch(groupBy, plan.groupKey);

      if (change) {
        await updateTask(wsId, plan.taskId, change);
      }

      await moveTask(wsId, plan.taskId, {
        listId,
        ...(plan.previousId ? { previousId: plan.previousId } : {}),
        ...(plan.nextId ? { nextId: plan.nextId } : {}),
      });
    },
    onMutate: ({ plan }: { plan: TaskDropPlan }) =>
      paint((data) =>
        moveTaskInPages(
          data,
          plan,
          plan.groupKey === plan.fromGroupKey
            ? null
            : (groupPatch(groupBy, plan.groupKey) as Partial<Task> | null),
        ),
      ),
    onError: (error, _variables, snapshot) => {
      rollback(snapshot, error);
    },
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: ({ id }: { id: string; name: string }) => deleteTask(wsId, id),
    onMutate: ({ id }: { id: string; name: string }) =>
      paint((data) => removeTasksFromPages(data, [id])),
    onError: (error, _variables, snapshot) => {
      rollback(snapshot, error);
    },
    onSuccess: (_data, { name }) => {
      refresh();
      toast.success(`"${name}" foi para a lixeira.`);
    },
  });

  const bulk = useMutation({
    mutationFn: ({ ids, changes }: BulkVariables) => bulkTasks(wsId, ids, changes),
    onMutate: ({ ids, changes, optimistic }: BulkVariables) =>
      paint((data) =>
        changes.deleted === true
          ? removeTasksFromPages(data, ids)
          : patchTasksInPages(data, ids, optimistic ?? (() => changes as Partial<Task>)),
      ),
    onError: (error, _variables, snapshot) => {
      rollback(snapshot, error);
    },
    onSuccess: (result, { ids }) => {
      refresh();

      if (result.skipped.length > 0) {
        toast.warning(
          `${String(result.updated)} de ${String(ids.length)} tarefas alteradas; o resto você não pode editar.`,
        );

        return;
      }

      toast.success(
        result.updated === 1
          ? '1 tarefa alterada.'
          : `${String(result.updated)} tarefas alteradas.`,
      );
    },
  });

  const create = useMutation({
    mutationFn: ({ body, targetListId }: { body: CreateTaskInput; targetListId?: string }) =>
      createTask(wsId, targetListId ?? listId, body),
    onSuccess: refresh,
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  return { patch, move, remove, bulk, create };
}
