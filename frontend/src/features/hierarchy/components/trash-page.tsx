import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { TrashItem } from '@/api/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { FormAlert } from '@/features/auth/components/field';
import { workspaceQuery } from '@/features/settings/api';
import { ConfirmDialog } from '@/features/settings/components/confirm-dialog';
import { canAdmin } from '@/features/settings/roles';
import { PageHeader } from '@/features/shell/components/page-header';
import { purgeTrashItem, restoreTrashItem, trashQuery } from '../api';
import { ENTITY_LABEL } from '../node-kinds';
import { EntityList } from './entity-list';

/** Itens excluídos nos últimos 30 dias, com restaurar e apagar de vez. */
export function TrashPage({ wsId }: { wsId: string }) {
  const queryClient = useQueryClient();
  const trash = useQuery(trashQuery(wsId));
  const workspace = useQuery(workspaceQuery(wsId));
  const [pending, setPending] = useState<TrashItem | null>(null);
  const isAdmin = workspace.data ? canAdmin(workspace.data.role) : false;

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.trash(wsId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.tree(wsId) });
  };

  const restore = useMutation({
    mutationFn: (item: TrashItem) => restoreTrashItem(wsId, item.entityType, item.id),
    onSuccess: (_data, item) => {
      refresh();
      toast.success(`“${item.name}” restaurado.`);
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const purge = useMutation({
    mutationFn: (item: TrashItem) => purgeTrashItem(wsId, item.entityType, item.id),
    onSuccess: (_data, item) => {
      refresh();
      setPending(null);
      toast.success(`“${item.name}” apagado de vez.`);
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const items = trash.data ?? [];

  return (
    <div className="flex flex-col gap-5 pb-8">
      <PageHeader
        wsId={wsId}
        title="Lixeira"
        description="O que foi excluído fica aqui por 30 dias e depois é apagado sozinho."
      />

      <div className="flex flex-col gap-3 px-4 md:px-6">
        {trash.isPending ? <Skeleton className="h-24" /> : null}
        {trash.isError ? <FormAlert>{errorMessage(trash.error)}</FormAlert> : null}

        {trash.data && items.length === 0 ? (
          <EmptyState title="Lixeira vazia" description="Nada foi excluído nos últimos 30 dias." />
        ) : null}

        {items.length > 0 ? (
          <EntityList
            items={items}
            stampLabel="Excluído em"
            actions={(item) => (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={restore.isPending}
                  onClick={() => {
                    restore.mutate(item);
                  }}
                >
                  {restore.isPending && restore.variables?.id === item.id ? (
                    <Spinner label="Restaurando" />
                  ) : (
                    'Restaurar'
                  )}
                </Button>
                {isAdmin ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger"
                    onClick={() => {
                      setPending(item);
                    }}
                  >
                    Apagar
                  </Button>
                ) : null}
              </>
            )}
          />
        ) : null}
      </div>

      {pending ? (
        <ConfirmDialog
          open
          danger
          onOpenChange={() => {
            setPending(null);
          }}
          title={`Apagar ${ENTITY_LABEL[pending.entityType]} de vez`}
          description={`“${pending.name}” e tudo que está dentro dele serão apagados. Não tem volta.`}
          confirmLabel="Apagar de vez"
          pending={purge.isPending}
          onConfirm={() => {
            purge.mutate(pending);
          }}
        />
      ) : null}
    </div>
  );
}
