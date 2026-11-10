import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { TrashItem } from '@/api/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { FormAlert } from '@/features/auth/components/field';
import { PageHeader } from '@/features/shell/components/page-header';
import { unarchiveTask } from '@/features/tasks/api';
import { archivedQuery } from '../api';
import { useUnarchiveNode } from '../hooks/use-hierarchy-actions';
import { EntityList } from './entity-list';

/** Spaces, Folders, Lists e tarefas arquivados, com Desarquivar em cada linha. */
export function ArchivedPage({ wsId }: { wsId: string }) {
  const queryClient = useQueryClient();
  const archived = useQuery(archivedQuery(wsId));
  const unarchive = useUnarchiveNode(wsId);
  const items = archived.data ?? [];

  const unarchiveTaskItem = useMutation({
    mutationFn: ({ id }: { id: string; name: string }) => unarchiveTask(wsId, id),
    onSuccess: (_data, { name }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.archived(wsId) });
      void queryClient.invalidateQueries({ queryKey: ['workspaces', wsId, 'tasks'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tree(wsId) });
      toast.success(`“${name}” desarquivada.`);
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const pending = (item: TrashItem): boolean =>
    item.entityType === 'task'
      ? unarchiveTaskItem.isPending && unarchiveTaskItem.variables?.id === item.id
      : unarchive.isPending && unarchive.variables?.id === item.id;

  return (
    <div className="flex flex-col gap-5 pb-8">
      <PageHeader
        wsId={wsId}
        title="Arquivados"
        description="Itens fora da árvore que continuam inteiros. Desarquive para trazer de volta."
      />

      <div className="flex flex-col gap-3 px-4 md:px-6">
        {archived.isPending ? <Skeleton className="h-24" /> : null}
        {archived.isError ? <FormAlert>{errorMessage(archived.error)}</FormAlert> : null}

        {archived.data && items.length === 0 ? (
          <EmptyState
            title="Nada arquivado"
            description="Quando você arquivar um Space, Folder, List ou tarefa, ele aparece aqui."
          />
        ) : null}

        {items.length > 0 ? (
          <EntityList
            items={items}
            stampLabel="Arquivado em"
            actions={(item) => (
              <Button
                variant="outline"
                size="sm"
                disabled={unarchive.isPending || unarchiveTaskItem.isPending}
                onClick={() => {
                  if (item.entityType === 'task') {
                    unarchiveTaskItem.mutate({ id: item.id, name: item.name });

                    return;
                  }

                  unarchive.mutate({ kind: item.entityType, id: item.id, name: item.name });
                }}
              >
                {pending(item) ? <Spinner label="Desarquivando" /> : 'Desarquivar'}
              </Button>
            )}
          />
        ) : null}
      </div>
    </div>
  );
}
