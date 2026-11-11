import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useCallback } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { Message } from '@/api/types';
import { toast } from '@/components/ui/toast';
import { deleteMessage, reactToMessage, sendMessage, updateMessage } from '../api';
import { appendReply, prependMessage, removeMessage, replaceMessage } from '../chat-model';

interface Page {
  items: Message[];
  nextCursor: string | null;
}

type Pages = InfiniteData<Page, string | undefined>;

export interface MessageDraft {
  body: Record<string, unknown>;
  bodyText: string;
  attachmentIds?: string[];
}

export interface MessageActions {
  send: (draft: MessageDraft) => Promise<Message | null>;
  reply: (parentMessageId: string, draft: MessageDraft) => Promise<Message | null>;
  edit: (messageId: string, draft: MessageDraft, parentMessageId: string | null) => void;
  react: (messageId: string, emoji: string, parentMessageId: string | null) => void;
  remove: (messageId: string, parentMessageId: string | null) => void;
  sending: boolean;
  /** Mensagem que está sendo escrita agora, para travar os botões dela. */
  busyId: string | null;
}

/**
 * Escritas das mensagens de um canal. Cada resposta da API volta como a
 * mensagem inteira, então o cache da conversa e o da thread são remendados na
 * hora; só a atividade do chat (não lidas) é invalidada.
 */
export function useMessages(wsId: string, channelId: string): MessageActions {
  const queryClient = useQueryClient();
  const listKey = queryKeys.messages(wsId, channelId);

  const refreshActivity = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.chatActivity(wsId) });
  }, [queryClient, wsId]);

  const keyOf = useCallback(
    (parentMessageId: string | null) =>
      parentMessageId === null ? listKey : queryKeys.messageReplies(wsId, parentMessageId),
    [listKey, wsId],
  );

  const mapPages = useCallback(
    (parentMessageId: string | null, change: (pages: Page[]) => Page[]) => {
      queryClient.setQueryData<Pages>(keyOf(parentMessageId), (data) =>
        data ? { ...data, pages: change(data.pages) } : data,
      );
    },
    [keyOf, queryClient],
  );

  const onError = (error: unknown): void => {
    toast.error(errorMessage(error));
  };

  const create = useMutation({
    mutationFn: ({ draft, parentMessageId }: { draft: MessageDraft; parentMessageId?: string }) =>
      sendMessage(wsId, channelId, {
        bodyText: draft.bodyText,
        body: draft.body,
        ...(draft.attachmentIds?.length ? { attachmentIds: draft.attachmentIds } : {}),
        ...(parentMessageId ? { parentMessageId } : {}),
      }),
    onSuccess: (message) => {
      if (message.parentMessageId === null) {
        mapPages(null, (pages) => prependMessage(pages, message));
      } else {
        const parentId = String(message.parentMessageId);

        mapPages(parentId, (pages) => appendReply(pages, message));
        // A raiz guarda replyCount e lastReplyAt denormalizados.
        void queryClient.invalidateQueries({ queryKey: listKey });
      }

      refreshActivity();
    },
    onError,
  });

  const write = useMutation({
    mutationFn: ({
      run,
    }: {
      id: string;
      parentMessageId: string | null;
      run: () => Promise<Message>;
    }) => run(),
    onSuccess: (message, variables) => {
      mapPages(variables.parentMessageId, (pages) => replaceMessage(pages, message));
    },
    onError,
  });

  const drop = useMutation({
    mutationFn: ({ messageId }: { messageId: string; parentMessageId: string | null }) =>
      deleteMessage(wsId, messageId),
    onSuccess: (_result, variables) => {
      mapPages(variables.parentMessageId, (pages) => removeMessage(pages, variables.messageId));

      if (variables.parentMessageId !== null) {
        void queryClient.invalidateQueries({ queryKey: listKey });
      }

      refreshActivity();
      toast.success('Mensagem excluída.');
    },
    onError,
  });

  const busyId = write.isPending
    ? write.variables.id
    : drop.isPending
      ? drop.variables.messageId
      : null;

  const run = async (draft: MessageDraft, parentMessageId?: string): Promise<Message | null> => {
    try {
      return await create.mutateAsync(
        parentMessageId === undefined ? { draft } : { draft, parentMessageId },
      );
    } catch {
      return null;
    }
  };

  return {
    send: (draft) => run(draft),
    reply: (parentMessageId, draft) => run(draft, parentMessageId),
    edit: (messageId, draft, parentMessageId) => {
      write.mutate({
        id: messageId,
        parentMessageId,
        run: () => updateMessage(wsId, messageId, { bodyText: draft.bodyText, body: draft.body }),
      });
    },
    react: (messageId, emoji, parentMessageId) => {
      write.mutate({
        id: messageId,
        parentMessageId,
        run: () => reactToMessage(wsId, messageId, emoji),
      });
    },
    remove: (messageId, parentMessageId) => {
      drop.mutate({ messageId, parentMessageId });
    },
    sending: create.isPending,
    busyId,
  };
}
