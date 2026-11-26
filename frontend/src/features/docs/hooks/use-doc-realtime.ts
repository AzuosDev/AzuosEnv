import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/keys';
import { useSession } from '@/features/auth/session';
import { useRealtimeRoom, useSocketEvent } from '@/features/realtime/realtime';

interface PageEvent {
  docId?: string;
  pageId?: string;
  actorId?: string;
}

export interface DocRealtimeOptions {
  wsId: string;
  docId: string;
  /** Página aberta; `page.updated` de outra pessoa nela vira aviso. */
  pageId: string | undefined;
  onPageUpdated: () => void;
}

/**
 * Sala doc:{id}: página nova ou excluída atualiza a árvore e comentário novo
 * atualiza a lateral. A página aberta não é invalidada quando outra pessoa
 * salva — isso apagaria o que está sendo digitado, então só vira um aviso.
 */
export function useDocRealtime({ wsId, docId, pageId, onPageUpdated }: DocRealtimeOptions): void {
  const client = useQueryClient();
  const user = useSession();

  useRealtimeRoom('doc', docId);

  useSocketEvent<PageEvent>('page.created', (payload) => {
    if (payload.docId !== undefined && payload.docId !== docId) {
      return;
    }

    void client.invalidateQueries({ queryKey: queryKeys.docPages(wsId, docId) });
  });

  useSocketEvent<PageEvent>('page.updated', (payload) => {
    if (payload.docId !== undefined && payload.docId !== docId) {
      return;
    }

    void client.invalidateQueries({ queryKey: queryKeys.docPages(wsId, docId) });

    const mine = payload.actorId !== undefined && payload.actorId === user?.id;

    if (!mine && payload.pageId !== undefined && payload.pageId === pageId) {
      onPageUpdated();
    }
  });

  useSocketEvent<PageEvent>('page.commented', (payload) => {
    if (payload.pageId === undefined) {
      return;
    }

    void client.invalidateQueries({ queryKey: queryKeys.pageComments(wsId, payload.pageId) });
  });
}
