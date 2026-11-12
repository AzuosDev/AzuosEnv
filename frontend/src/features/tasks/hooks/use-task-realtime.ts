import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { queryKeys } from '@/api/keys';
import { useSocket, useSocketEvent } from '@/features/realtime/socket';

/** Payload comum dos eventos de tarefa do gateway. */
interface TaskEvent {
  taskId: string;
  customId: string;
  actorId: string;
}

/** Payload comum dos eventos de comentário do gateway. */
interface CommentEvent {
  commentId: string;
  taskId: string | null;
  actorId: string;
}

interface PresenceEvent {
  taskId: string;
  userIds: string[];
}

export interface TaskRealtimeOptions {
  wsId: string;
  /** Id real da tarefa: é o que nomeia a sala task:{id}. */
  taskId: string | undefined;
  /** Id da URL: é a chave do cache do painel. */
  customId: string;
  currentUserId: string | undefined;
}

/**
 * Tempo real da tarefa aberta: entra na sala task:{id}, refaz o painel quando
 * outra pessoa escreve e devolve quem está vendo a tarefa agora.
 */
export function useTaskRealtime({
  wsId,
  taskId,
  customId,
  currentUserId,
}: TaskRealtimeOptions): string[] {
  const queryClient = useQueryClient();
  const { socket, connected } = useSocket();
  const [viewers, setViewers] = useState<string[]>([]);

  useEffect(() => {
    if (!socket || !connected || !taskId) {
      return;
    }

    socket.emit('join', { room: 'task', id: taskId, wsId });

    return () => {
      socket.emit('leave', { room: 'task', id: taskId, wsId });
      setViewers([]);
    };
  }, [socket, connected, taskId, wsId]);

  const refreshTask = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.task(wsId, customId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.taskActivity(wsId, customId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.subtasks(wsId, customId) });
  }, [customId, queryClient, wsId]);

  const mine = useCallback(
    (actorId: string) => Boolean(currentUserId) && actorId === currentUserId,
    [currentUserId],
  );

  useSocketEvent<TaskEvent>('task.updated', (event) => {
    if (event.customId === customId && !mine(event.actorId)) {
      refreshTask();
    }
  });

  useSocketEvent<TaskEvent>('task.moved', (event) => {
    if (event.customId === customId && !mine(event.actorId)) {
      refreshTask();
    }
  });

  useSocketEvent<CommentEvent>('comment.created', (event) => {
    if (event.taskId === taskId && !mine(event.actorId)) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.comments(wsId, customId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.taskActivity(wsId, customId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.task(wsId, customId) });
    }
  });

  useSocketEvent<CommentEvent>('comment.updated', (event) => {
    if (event.taskId === taskId && !mine(event.actorId)) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.comments(wsId, customId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.taskActivity(wsId, customId) });
    }
  });

  useSocketEvent<PresenceEvent>('presence:update', (event) => {
    if (event.taskId === taskId) {
      setViewers(event.userIds);
    }
  });

  return viewers;
}
