import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { EffectiveStatus, Task, UpdateTaskInput } from '@/api/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { FormAlert } from '@/features/auth/components/field';
import { myTasksQuery } from '@/features/inbox/api';
import { membersQuery } from '@/features/settings/api';
import { treeQuery } from '@/features/shell/api';
import { PageHeader } from '@/features/shell/components/page-header';
import { listStatusesQuery, updateTask } from '@/features/tasks/api';
import { TaskLine } from '@/features/tasks/components/task-line';
import { findLocation } from '@/features/shell/tree-path';
import { listIdsOf, sectionsOf } from '../my-tasks-model';

const NO_STATUSES: EffectiveStatus[] = [];

/**
 * Minhas tarefas: as tarefas abertas em que a pessoa é responsável, por seção de
 * prazo. Cada List traz o próprio conjunto de statuses, então a linha edita o
 * status com a lista certa.
 */
export function MyTasksPage({ wsId }: { wsId: string }) {
  const queryClient = useQueryClient();
  const mine = useQuery(myTasksQuery(wsId));
  const members = useQuery(membersQuery(wsId));
  const tree = useQuery(treeQuery(wsId));
  const sections = useMemo(() => sectionsOf(mine.data?.sections), [mine.data]);
  const listIds = useMemo(() => listIdsOf(mine.data?.sections), [mine.data]);
  const statusQueries = useQueries({
    queries: listIds.map((listId) => listStatusesQuery(wsId, listId)),
  });
  const listNames = useMemo(() => {
    const map = new Map<string, string>();

    for (const listId of listIds) {
      const location = findLocation(tree.data, 'list', listId);

      if (location) {
        map.set(listId, location.name);
      }
    }

    return map;
  }, [listIds, tree.data]);
  const statusesByList = useMemo(() => {
    const map = new Map<string, EffectiveStatus[]>();

    listIds.forEach((listId, index) => {
      map.set(listId, statusQueries[index]?.data?.statuses ?? NO_STATUSES);
    });

    return map;
  }, [listIds, statusQueries]);

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateTaskInput; optimistic?: Partial<Task> }) =>
      updateTask(wsId, id, body),
    onMutate: ({ id, body, optimistic }) => {
      const key = queryKeys.myTasks(wsId);
      const snapshot = queryClient.getQueryData(key);

      queryClient.setQueryData(key, (current: typeof mine.data) =>
        current
          ? {
              ...current,
              sections: Object.fromEntries(
                Object.entries(current.sections).map(([bucket, items]) => [
                  bucket,
                  items.map((item) =>
                    item.id === id ? { ...item, ...(optimistic ?? (body as Partial<Task>)) } : item,
                  ),
                ]),
              ) as typeof current.sections,
            }
          : current,
      );

      return snapshot;
    },
    onError: (error, _variables, snapshot) => {
      if (snapshot) {
        queryClient.setQueryData(queryKeys.myTasks(wsId), snapshot);
      }

      toast.error(errorMessage(error));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.myTasks(wsId) });
      void queryClient.invalidateQueries({ queryKey: ['workspaces', wsId, 'tasks'] });
    },
  });

  return (
    <div className="flex flex-col gap-5 pb-8">
      <PageHeader
        wsId={wsId}
        title="Minhas tarefas"
        description="Tudo em que você é responsável e que ainda não foi concluído."
      />

      <div className="flex min-w-0 max-w-[960px] flex-col gap-5 px-4 md:px-6">
        {mine.isPending ? <Skeleton className="h-40" /> : null}
        {mine.isError ? <FormAlert>{errorMessage(mine.error)}</FormAlert> : null}

        {mine.data && sections.length === 0 ? (
          <EmptyState
            title="Nada atribuído a você"
            description="Quando alguém colocar você como responsável, a tarefa aparece aqui."
            action={
              <Button
                variant="ghost"
                onClick={() => {
                  void queryClient.invalidateQueries({ queryKey: queryKeys.myTasks(wsId) });
                }}
              >
                Atualizar
              </Button>
            }
          />
        ) : null}

        {sections.map((section) => (
          <section key={section.key} className="flex min-w-0 flex-col">
            <div className="flex items-center gap-2 border-b border-line px-3 pb-2">
              <h2 className={`text-[14px] font-semibold ${section.tone}`}>{section.label}</h2>
              <span className="text-[12px] text-muted">{section.items.length}</span>
            </div>

            <ul className="flex min-w-0 flex-col">
              {section.items.map((task) => (
                <TaskLine
                  key={task.id}
                  wsId={wsId}
                  task={task}
                  statuses={statusesByList.get(task.listId) ?? NO_STATUSES}
                  members={members.data ?? []}
                  canEdit
                  {...(listNames.has(task.listId)
                    ? { listName: listNames.get(task.listId) ?? '' }
                    : {})}
                  onPatch={(body, optimistic) => {
                    patch.mutate({ id: task.id, body, ...(optimistic ? { optimistic } : {}) });
                  }}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
