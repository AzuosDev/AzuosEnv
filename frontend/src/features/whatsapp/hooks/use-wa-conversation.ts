import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import { toast } from '@/components/ui/toast';
import type { WaConversationPriority } from '@/api/types';
import {
  assignWaConversation,
  closeWaConversation,
  markWaConversationRead,
  reopenWaConversation,
  setWaMode,
  setWaPriority,
} from '../api';

export interface WaConversationActions {
  pending: boolean;
  assign: (assigneeId: string | null) => Promise<void>;
  priority: (priority: WaConversationPriority) => Promise<void>;
  /** "Devolver ao bot": volta para o modo bot e limpa a pausa. */
  backToBot: () => Promise<void>;
  takeOver: () => Promise<void>;
  close: () => Promise<void>;
  reopen: () => Promise<void>;
}

/** Ações do cabeçalho da conversa, com aviso de erro e cache refeito. */
export function useWaConversationActions(
  wsId: string,
  conversationId: string | null,
): WaConversationActions {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ['workspaces', wsId, 'whatsapp', 'conversations'],
    });
  }, [queryClient, wsId]);

  const run = useCallback(
    async (action: (id: string) => Promise<void>, success: string): Promise<void> => {
      if (!conversationId) {
        return;
      }

      setPending(true);

      try {
        await action(conversationId);
        refresh();
        toast.success(success);
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setPending(false);
      }
    },
    [conversationId, refresh],
  );

  return {
    pending,
    assign: (assigneeId) =>
      run(
        (id) => assignWaConversation(wsId, id, assigneeId),
        assigneeId ? 'Responsável definido.' : 'Conversa devolvida à fila.',
      ),
    priority: (priority) =>
      run((id) => setWaPriority(wsId, id, priority), 'Prioridade atualizada.'),
    backToBot: () => run((id) => setWaMode(wsId, id, 'bot'), 'Conversa devolvida ao bot.'),
    takeOver: () => run((id) => setWaMode(wsId, id, 'human'), 'Bot pausado nesta conversa.'),
    close: () => run((id) => closeWaConversation(wsId, id), 'Conversa finalizada.'),
    reopen: () => run((id) => reopenWaConversation(wsId, id), 'Conversa reaberta.'),
  };
}

/**
 * Marca a conversa aberta como lida. Roda uma vez por conversa, porque a
 * chamada também marca a leitura na Meta.
 */
export function useMarkWaRead(wsId: string, conversationId: string | null): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    let cancelled = false;

    void markWaConversationRead(wsId, conversationId)
      .then(() => {
        if (cancelled) {
          return;
        }

        void queryClient.invalidateQueries({
          queryKey: ['workspaces', wsId, 'whatsapp', 'conversations'],
        });
        void queryClient.invalidateQueries({ queryKey: queryKeys.inboxCounts(wsId) });
      })
      .catch(() => {
        // Marcar como lida é melhoria de conforto: falhar aqui não atrapalha.
      });

    return () => {
      cancelled = true;
    };
  }, [wsId, conversationId, queryClient]);
}
