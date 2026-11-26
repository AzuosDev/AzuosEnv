import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { queryKeys } from '@/api/keys';
import type { ChatActivity, WorkspaceMemberItem } from '@/api/types';
import { toast } from '@/components/ui/toast';
import { useRealtimeEvent } from '@/features/realtime/realtime';
import { membersQuery } from '@/features/settings/api';

/** Resumo que `channel.activity` entrega na sala do usuário ou do workspace. */
export interface ChannelActivityEvent {
  workspaceId: string;
  channelId: string;
  channelName: string;
  channelType: 'channel' | 'dm' | 'group';
  messageId: string;
  parentMessageId: string | null;
  authorId: string;
  mentions: string[];
  preview: string;
}

/** Soma uma não lida no canal, criando a linha se o resumo ainda não a tinha. */
export function withNewMessage(
  activity: ChatActivity | undefined,
  event: ChannelActivityEvent,
  at: string,
): ChatActivity | undefined {
  if (!activity) {
    return activity;
  }

  const known = activity.items.some((item) => item.channelId === event.channelId);
  const items = known
    ? activity.items.map((item) =>
        item.channelId === event.channelId
          ? { ...item, unread: item.unread + 1, lastMessageAt: at }
          : item,
      )
    : [
        ...activity.items,
        {
          channelId: event.channelId,
          type: event.channelType,
          name: event.channelName,
          unread: 1,
          lastMessageAt: at,
          lastReadAt: null,
        },
      ];

  return { items, unread: activity.unread + 1 };
}

/** Título do aviso: quem escreveu, quando dá para saber o nome. */
export function activityTitle(authorName: string | undefined, channelName: string): string {
  if (authorName && authorName !== '') {
    return `Nova mensagem de ${authorName}`;
  }

  return `Nova mensagem em ${channelName}`;
}

export interface ChatActivityOptions {
  wsId: string;
  currentUserId: string | undefined;
  /** Canal aberto na tela: ele já recebe a mensagem pela sala do canal. */
  openChannelId?: string;
}

/**
 * Mensagem nova de uma conversa que não está aberta: atualiza as não lidas da
 * lateral e o badge do Chat no cache e avisa com um toast clicável, em qualquer
 * tela do app. É o que faltava para o Chat fechado contar a novidade — antes o
 * evento só existia dentro da sala do canal, assinada pela tela do Chat.
 */
export function useChatActivity({ wsId, currentUserId, openChannelId }: ChatActivityOptions): void {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  /** Um aviso por mensagem, mesmo que o resumo chegue por dois canais. */
  const seen = useRef(new Set<string>());

  const handle = useCallback(
    (event: ChannelActivityEvent) => {
      if (event.workspaceId !== wsId || event.authorId === currentUserId) {
        return;
      }

      if (seen.current.has(event.messageId)) {
        return;
      }

      seen.current.add(event.messageId);

      if (seen.current.size > 200) {
        seen.current.clear();
      }

      queryClient.setQueryData<ChatActivity>(queryKeys.chatActivity(wsId), (current) =>
        withNewMessage(current, event, new Date().toISOString()),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.chatActivity(wsId) });
      // A lista de conversas mostra a última mensagem de cada canal.
      void queryClient.invalidateQueries({ queryKey: ['workspaces', wsId, 'channels'] });

      // A conversa aberta já atualiza pela sala do canal: só o aviso sobra.
      if (event.channelId === openChannelId) {
        return;
      }

      // Nome de quem escreveu sai do cache dos membros; sem ele o aviso cita o canal.
      const members = queryClient.getQueryData<WorkspaceMemberItem[]>(membersQuery(wsId).queryKey);
      const author = members?.find((member) => member.userId.id === event.authorId)?.userId.name;

      toast.message(activityTitle(author, event.channelName), {
        description: event.preview,
        action: {
          label: 'Abrir',
          onClick: () => {
            void navigate({
              to: '/w/$wsId/chat',
              params: { wsId },
              search: { canal: event.channelId },
            });
          },
        },
      });
    },
    [currentUserId, navigate, openChannelId, queryClient, wsId],
  );

  useRealtimeEvent<ChannelActivityEvent>('channel.activity', handle);
}
