import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { Notification } from '@/api/types';
import { toast } from '@/components/ui/toast';
import {
  clearNotification,
  markNotificationRead,
  markNotificationUnread,
  readAllNotifications,
  snoozeNotification,
} from '../api';

interface Page {
  items: Notification[];
  nextCursor: string | null;
}

interface Pages {
  pages: Page[];
  pageParams: unknown[];
}

/** Escritas do Inbox: a linha responde na hora e o badge é refeito no fim. */
export function useInboxActions(wsId: string) {
  const queryClient = useQueryClient();

  const refreshCounts = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.inboxCounts(wsId) });
  }, [queryClient, wsId]);

  /** Todas as abas voltam a ser buscadas: a entrada troca de aba ao adiar ou limpar. */
  const refreshTabs = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['workspaces', wsId, 'inbox'] });
  }, [queryClient, wsId]);

  const fail = useCallback((error: unknown) => {
    toast.error(errorMessage(error));
  }, []);

  /** Pinta readAt nas páginas já carregadas da aba. */
  const paint = useCallback(
    (tab: string, notificationId: string, readAt: string | null) => {
      const key = queryKeys.inbox(wsId, tab);
      const snapshot = queryClient.getQueryData<Pages>(key);

      queryClient.setQueryData<Pages>(key, (current) =>
        current
          ? {
              ...current,
              pages: current.pages.map((page) => ({
                ...page,
                items: page.items.map((item) =>
                  item.id === notificationId ? { ...item, readAt } : item,
                ),
              })),
            }
          : current,
      );

      return snapshot;
    },
    [queryClient, wsId],
  );

  const setRead = useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean; tab: string }) =>
      read ? markNotificationRead(wsId, id) : markNotificationUnread(wsId, id),
    onMutate: ({ id, read, tab }) => paint(tab, id, read ? new Date().toISOString() : null),
    onError: (error, { tab }, snapshot) => {
      if (snapshot) {
        queryClient.setQueryData(queryKeys.inbox(wsId, tab), snapshot);
      }

      fail(error);
    },
    onSuccess: refreshCounts,
  });

  const readAll = useMutation({
    mutationFn: () => readAllNotifications(wsId),
    onSuccess: () => {
      refreshTabs();
      refreshCounts();
      toast.success('Tudo marcado como lido.');
    },
    onError: fail,
  });

  const snooze = useMutation({
    mutationFn: ({ id, until }: { id: string; until: string; label: string }) =>
      snoozeNotification(wsId, id, until),
    onSuccess: (_data, { label }) => {
      refreshTabs();
      refreshCounts();
      toast.success(`Adiado para ${label.toLowerCase()}.`);
    },
    onError: fail,
  });

  const clear = useMutation({
    mutationFn: ({ id }: { id: string }) => clearNotification(wsId, id),
    onSuccess: () => {
      refreshTabs();
      refreshCounts();
      toast.success('Notificação limpa.');
    },
    onError: fail,
  });

  return { setRead, readAll, snooze, clear };
}
