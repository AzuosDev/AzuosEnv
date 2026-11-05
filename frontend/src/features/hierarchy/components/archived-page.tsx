import { useQuery } from '@tanstack/react-query';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { FormAlert } from '@/features/auth/components/field';
import { PageHeader } from '@/features/shell/components/page-header';
import { archivedQuery } from '../api';
import { useUnarchiveNode } from '../hooks/use-hierarchy-actions';
import { EntityList } from './entity-list';

/** Spaces, Folders e Lists arquivados; as tarefas entram na etapa delas. */
export function ArchivedPage({ wsId }: { wsId: string }) {
  const archived = useQuery(archivedQuery(wsId));
  const unarchive = useUnarchiveNode(wsId);
  const items = (archived.data ?? []).filter((item) => item.entityType !== 'task');

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
            description="Quando você arquivar um Space, Folder ou List, ele aparece aqui."
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
                disabled={unarchive.isPending}
                onClick={() => {
                  if (item.entityType === 'task') {
                    return;
                  }

                  unarchive.mutate({ kind: item.entityType, id: item.id, name: item.name });
                }}
              >
                {unarchive.isPending && unarchive.variables?.id === item.id ? (
                  <Spinner label="Desarquivando" />
                ) : (
                  'Desarquivar'
                )}
              </Button>
            )}
          />
        ) : null}
      </div>
    </div>
  );
}
