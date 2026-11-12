import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { queryKeys } from '@/api/keys';
import { useSocket, useSocketEvent } from '@/features/realtime/socket';

/** O que `message.new`, `message.updated` e `message.deleted` mandam na sala. */
export interface MessageEvent {
  workspaceId: string;
  channelId: string;
  channelType: string;
  messageId: string;
  parentMessageId: string | null;
  authorId: string;
  mentions: string[];
  preview: string;
}

/** Sinal efêmero de digitação relaído pelo gateway. */
interface TypingEvent {
  channelId: string;
  userId: string;
  typing: boolean;
}

/** Salas de canal assinadas de uma vez; a lateral não precisa de mais. */
export const MAX_CHAT_ROOMS = 30;

/** Depois de quanto tempo sem sinal a pessoa deixa de constar como digitando. */
const TYPING_TIMEOUT_MS = 6000;

/**
 * Entra nas salas dos canais visíveis e mantém as não lidas e a conversa aberta
 * em dia. A mensagem nova chega sem o corpo, então o cache do canal é refeito;
 * a atividade do chat (badge da Sidebar) é refeita em qualquer canal.
 */
export function useChatRealtime(wsId: string, channelIds: string[]): void {
  const queryClient = useQueryClient();
  const { socket, connected } = useSocket();
  const rooms = channelIds.slice(0, MAX_CHAT_ROOMS);
  const key = rooms.join(',');

  useEffect(() => {
    if (!socket || !connected || key === '') {
      return;
    }

    const joined = key.split(',');

    for (const channelId of joined) {
      socket.emit('join', { room: 'channel', id: channelId, wsId });
    }

    return () => {
      for (const channelId of joined) {
        socket.emit('leave', { room: 'channel', id: channelId, wsId });
      }
    };
  }, [socket, connected, key, wsId]);

  const refresh = useCallback(
    (event: MessageEvent) => {
      if (event.workspaceId !== wsId) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.chatActivity(wsId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.messages(wsId, event.channelId),
      });

      if (event.parentMessageId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.messageReplies(wsId, event.parentMessageId),
        });
      }
    },
    [queryClient, wsId],
  );

  useSocketEvent<MessageEvent>('message.new', refresh);
  useSocketEvent<MessageEvent>('message.updated', refresh);
  useSocketEvent<MessageEvent>('message.deleted', refresh);

  // A conexão voltou: a conversa pode ter perdido mensagem no meio.
  const wasConnected = useRef(connected);

  useEffect(() => {
    if (connected && !wasConnected.current) {
      void queryClient.invalidateQueries({ queryKey: ['workspaces', wsId, 'channels'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chatActivity(wsId) });
    }

    wasConnected.current = connected;
  }, [connected, queryClient, wsId]);
}

export interface TypingState {
  /** Ids de quem está digitando no canal agora, sem o próprio usuário. */
  userIds: string[];
  /** Avisa a sala que o usuário está escrevendo; o gateway não guarda nada. */
  notify: () => void;
  stop: () => void;
}

/**
 * "Digitando…" do canal aberto: o sinal é efêmero, então cada pessoa sai da
 * lista sozinha depois do tempo limite.
 */
export function useTyping(
  wsId: string,
  channelId: string,
  currentUserId: string | undefined,
): TypingState {
  const { socket, connected } = useSocket();
  const [seen, setSeen] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());
  const lastSent = useRef(0);

  useSocketEvent<TypingEvent>('typing', (event) => {
    if (event.channelId !== channelId || event.userId === currentUserId) {
      return;
    }

    setSeen((current) => {
      if (!event.typing) {
        const rest = { ...current };

        delete rest[event.userId];

        return rest;
      }

      return { ...current, [event.userId]: Date.now() };
    });
  });

  const active = Object.keys(seen).filter(
    (userId) => now - (seen[userId] ?? 0) < TYPING_TIMEOUT_MS,
  );

  // Só conta o tempo enquanto alguém está digitando.
  useEffect(() => {
    if (Object.keys(seen).length === 0) {
      return;
    }

    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1500);

    return () => {
      clearInterval(timer);
    };
  }, [seen]);

  useEffect(() => {
    setSeen({});
  }, [channelId]);

  const emit = useCallback(
    (typing: boolean) => {
      if (!socket || !connected || channelId === '') {
        return;
      }

      socket.emit('typing', { room: 'channel', id: channelId, wsId, typing });
    },
    [socket, connected, channelId, wsId],
  );

  return {
    userIds: active,
    notify: () => {
      const stamp = Date.now();

      // Um sinal a cada 2 s basta: o receptor espera até o tempo limite.
      if (stamp - lastSent.current < 2000) {
        return;
      }

      lastSent.current = stamp;
      emit(true);
    },
    stop: () => {
      lastSent.current = 0;
      emit(false);
    },
  };
}
