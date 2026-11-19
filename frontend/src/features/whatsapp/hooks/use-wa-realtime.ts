import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { queryKeys } from '@/api/keys';
import { toast } from '@/components/ui/toast';
import { useSocket, useSocketEvent } from '@/features/realtime/socket';

/** `message.new` da sala whatsapp:{wsId}; o chat usa o mesmo nome de evento. */
interface WaMessageEvent {
  workspaceId: string;
  conversationId: string;
  messageId: string;
  direction: 'inbound' | 'outbound';
  type: string;
  preview: string;
  authorId: string | null;
}

interface WaStatusEvent {
  workspaceId: string;
  conversationId: string;
  messageId: string;
  status: string;
}

interface WaConversationEvent {
  workspaceId: string;
  conversationId: string;
  status: string;
  assigneeId: string | null;
  unreadCount: number;
}

export interface WaRealtimeOptions {
  /** Conversa aberta agora: a mensagem dela não vira aviso. */
  openConversationId: string | null;
  /** Para saber se a conversa é de quem está olhando. */
  currentUserId: string | undefined;
}

/**
 * Mantém a Central em dia pelo socket: entra na sala do workspace, refaz a
 * lista e a conversa a cada evento e avisa com toast a mensagem nova que chega
 * em outra conversa.
 */
export function useWaRealtime(wsId: string, options: WaRealtimeOptions): void {
  const queryClient = useQueryClient();
  const { socket, connected } = useSocket();
  const open = options.openConversationId;

  useEffect(() => {
    if (!socket || !connected) {
      return;
    }

    socket.emit('join', { room: 'whatsapp', id: wsId, wsId });

    return () => {
      socket.emit('leave', { room: 'whatsapp', id: wsId, wsId });
    };
  }, [socket, connected, wsId]);

  const refreshList = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ['workspaces', wsId, 'whatsapp', 'conversations'],
    });
  }, [queryClient, wsId]);

  useSocketEvent<WaMessageEvent>('message.new', (event) => {
    // O chat emite `message.new` com outro formato na sala do canal.
    if (event.workspaceId !== wsId || typeof event.conversationId !== 'string') {
      return;
    }

    void queryClient.invalidateQueries({
      queryKey: queryKeys.waMessages(wsId, event.conversationId),
    });
    refreshList();

    if (event.direction === 'inbound' && event.conversationId !== open) {
      toast.info(`WhatsApp: ${event.preview || 'nova mensagem'}`);
    }
  });

  useSocketEvent<WaStatusEvent>('message.status', (event) => {
    if (event.workspaceId !== wsId || typeof event.conversationId !== 'string') {
      return;
    }

    void queryClient.invalidateQueries({
      queryKey: queryKeys.waMessages(wsId, event.conversationId),
    });
  });

  useSocketEvent<WaConversationEvent>('conversation.updated', (event) => {
    if (event.workspaceId !== wsId) {
      return;
    }

    void queryClient.invalidateQueries({
      queryKey: queryKeys.waConversation(wsId, event.conversationId),
    });
    refreshList();
  });

  // A conexão voltou: a lista pode ter perdido mensagem no meio.
  const wasConnected = useRef(connected);

  useEffect(() => {
    if (connected && !wasConnected.current) {
      refreshList();
    }

    wasConnected.current = connected;
  }, [connected, refreshList]);
}
