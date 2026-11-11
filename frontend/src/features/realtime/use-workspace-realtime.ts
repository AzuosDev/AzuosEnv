import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { queryKeys } from '@/api/keys';
import { toast } from '@/components/ui/toast';
import { describeNotification } from '@/features/inbox/notification-model';
import type { Notification } from '@/api/types';
import { useSocket, useSocketEvent } from './socket';

/** Payload dos eventos de tarefa do gateway. */
interface TaskEvent {
  workspaceId: string;
  taskId: string;
  customId: string;
  listId: string;
  actorId: string;
}

/** Payload dos eventos de comentário do gateway. */
interface CommentEvent {
  workspaceId: string;
  commentId: string;
  taskId: string | null;
  actorId: string;
}

/** O que `notification.new` manda na sala do usuário. */
interface NotificationEvent {
  id: string;
  workspaceId: string;
  type: Notification['type'];
  bucket: Notification['bucket'];
  entityType: Notification['entityType'];
  entityId: string;
  actorId: string | null;
  data: unknown;
}

export interface WorkspaceRealtimeOptions {
  wsId: string;
  currentUserId: string | undefined;
}

/**
 * Tempo real do workspace inteiro, montado uma vez no layout de /w/:wsId:
 * escrita de tarefa ou comentário de outra pessoa invalida as consultas de
 * tarefa, `notification.new` avisa com toast e refaz os contadores, e a volta da
 * conexão rebusca o que está aberto na tela.
 */
export function useWorkspaceRealtime({ wsId, currentUserId }: WorkspaceRealtimeOptions): void {
  const queryClient = useQueryClient();
  const { connected } = useSocket();
  const wasConnected = useRef(connected);

  const mine = useCallback(
    (actorId: string | null) => Boolean(currentUserId) && actorId === currentUserId,
    [currentUserId],
  );

  /** Toda consulta de tarefa do workspace: views, Minhas tarefas e a árvore. */
  const refreshTasks = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['workspaces', wsId, 'tasks'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.myTasks(wsId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.tree(wsId) });
  }, [queryClient, wsId]);

  const refreshInbox = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['workspaces', wsId, 'inbox'] });
  }, [queryClient, wsId]);

  /** Não lidas do chat: a mensagem só chega na sala do canal, mas a menção e a DM viram notificação. */
  const refreshChat = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.chatActivity(wsId) });
  }, [queryClient, wsId]);

  const onTask = useCallback(
    (event: TaskEvent) => {
      if (event.workspaceId === wsId && !mine(event.actorId)) {
        refreshTasks();
      }
    },
    [mine, refreshTasks, wsId],
  );

  useSocketEvent<TaskEvent>('task.created', onTask);
  useSocketEvent<TaskEvent>('task.updated', onTask);
  useSocketEvent<TaskEvent>('task.moved', onTask);
  useSocketEvent<TaskEvent>('task.deleted', onTask);

  useSocketEvent<CommentEvent>('comment.created', (event) => {
    if (event.workspaceId === wsId && !mine(event.actorId)) {
      refreshTasks();
    }
  });

  useSocketEvent<CommentEvent>('comment.updated', (event) => {
    if (event.workspaceId === wsId && !mine(event.actorId)) {
      void queryClient.invalidateQueries({ queryKey: ['workspaces', wsId, 'assigned-comments'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.replies(wsId) });
    }
  });

  useSocketEvent<NotificationEvent>('notification.new', (event) => {
    if (event.workspaceId !== wsId) {
      return;
    }

    refreshInbox();
    refreshChat();
    void queryClient.invalidateQueries({ queryKey: queryKeys.inboxCounts(wsId) });

    const card = describeNotification({
      type: event.type,
      actorId: event.actorId,
      data: event.data,
    } as Notification);

    toast.message(card.task ? `${card.task.customId}: ${card.verb}` : 'Nova notificação', {
      description: card.task?.name ?? card.detail ?? 'Abra o Inbox para ver.',
    });
  });

  // A conexão voltou: o que está na tela pode ter perdido evento no meio.
  useEffect(() => {
    if (connected && !wasConnected.current) {
      refreshTasks();
      refreshInbox();
      refreshChat();
      void queryClient.invalidateQueries({ queryKey: queryKeys.inboxCounts(wsId) });
    }

    wasConnected.current = connected;
  }, [connected, queryClient, refreshChat, refreshInbox, refreshTasks, wsId]);
}
