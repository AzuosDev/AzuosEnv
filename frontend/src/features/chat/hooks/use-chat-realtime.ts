import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { queryKeys } from '@/api/keys';
import { useSession } from '@/features/auth/session';
import { useRealtime, useSocket, useSocketEvent } from '@/features/realtime/realtime';
import { markChannelDelivered } from '../api';

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

/** O que `channel.read` manda: alguém leu o canal até aquele instante. */
export interface ChannelReadEvent {
  workspaceId: string;
  channelId: string;
  userId: string;
  lastReadAt: string;
}

/** Sinal efêmero de digitação relaído pelo gateway. */
interface TypingEvent {
  channelId: string;
  userId: string;
  typing: boolean;
}

/** Depois de quanto tempo sem sinal a pessoa deixa de constar como digitando. */
const TYPING_TIMEOUT_MS = 6000;

/**
 * Mantém a conversa aberta em dia: assina só a sala dela (mensagem, ticks de
 * visto e digitação). O que acontece nas outras conversas chega como resumo na
 * sala do usuário — ver `useChatActivity` —, então não há motivo para assinar
 * canal por canal, o que no Ably seria uma sala paga por conversa visível.
 */
export function useChatRealtime(wsId: string, openChannelId: string | undefined): void {
  const queryClient = useQueryClient();
  const user = useSession();
  const { connected, join, transport } = useRealtime();

  useEffect(() => {
    if (!transport || !openChannelId) {
      return;
    }

    return join('channel', openChannelId, wsId);
  }, [join, transport, openChannelId, wsId]);

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

  const refreshReads = useCallback(
    (event: Pick<ChannelReadEvent, 'workspaceId' | 'channelId'>) => {
      if (event.workspaceId !== wsId) {
        return;
      }

      void queryClient.invalidateQueries({
        queryKey: queryKeys.channelReads(wsId, event.channelId),
      });
    },
    [queryClient, wsId],
  );

  const refreshMessage = useCallback(
    (event: MessageEvent) => {
      // A própria mensagem já entrou no cache no envio: rebuscar só piscaria.
      if (event.authorId === user?.id) {
        return;
      }

      refresh(event);

      if (event.workspaceId === wsId) {
        void markChannelDelivered(wsId, event.channelId, event.messageId).catch(() => undefined);
      }
    },
    [refresh, user?.id, wsId],
  );

  useSocketEvent<ChannelReadEvent>('channel.read', refreshReads);
  useSocketEvent<MessageEvent>('message.new', refreshMessage);
  useSocketEvent<MessageEvent>('message.updated', refresh);
  useSocketEvent<MessageEvent>('message.deleted', refresh);
  useSocketEvent<Pick<ChannelReadEvent, 'workspaceId' | 'channelId'>>(
    'channel.delivered',
    refreshReads,
  );

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
