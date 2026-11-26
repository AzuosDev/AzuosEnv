import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useCallback } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { Message } from '@/api/types';
import { toast } from '@/components/ui/toast';
import { useSession } from '@/features/auth/session';
import { deleteMessage, reactToMessage, sendMessage, updateMessage } from '../api';
import { appendReply, prependMessage, removeMessage, replaceMessage } from '../chat-model';

/** Prefixo do id da mensagem que ainda não existe no servidor. */
export const PENDING_PREFIX = 'pendente:';

export function isPendingMessage(message: Message): boolean {
  return message.id.startsWith(PENDING_PREFIX);
}

interface Page {
  items: Message[];
  nextCursor: string | null;
}

type Pages = InfiniteData<Page, string | undefined>;

export interface MessageDraft {
  body: Record<string, unknown>;
  bodyText: string;
  attachmentIds?: string[];
  /** Mensagem citada na resposta, no estilo do WhatsApp. */
  replyToId?: string;
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
  const user = useSession();
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
        ...(draft.replyToId ? { replyToId: draft.replyToId } : {}),
        ...(parentMessageId ? { parentMessageId } : {}),
      }),
    /**
     * A mensagem entra na lista antes da resposta do servidor: em host
     * serverless a escrita leva o seu tempo, e esperar por ela fazia a conversa
     * parecer travada. O id provisório sai quando a de verdade chega.
     */
    onMutate: ({ draft, parentMessageId }) => {
      if (!user) {
        return { pendingId: null };
      }

      const pending = pendingMessage({
        wsId,
        channelId,
        authorId: user.id,
        draft,
        parentMessageId: parentMessageId ?? null,
      });

      mapPages(parentMessageId ?? null, (pages) =>
        parentMessageId ? appendReply(pages, pending) : prependMessage(pages, pending),
      );

      return { pendingId: pending.id };
    },
    onSuccess: (message, _variables, context) => {
      const parentId = message.parentMessageId === null ? null : String(message.parentMessageId);

      // Troca a provisória pela do servidor: a lista nunca mostra as duas.
      mapPages(parentId, (pages) => {
        const clean = context?.pendingId ? removeMessage(pages, context.pendingId) : pages;

        return parentId === null ? prependMessage(clean, message) : appendReply(clean, message);
      });

      if (parentId !== null) {
        // A raiz guarda replyCount e lastReplyAt denormalizados.
        void queryClient.invalidateQueries({ queryKey: listKey });
      }

      refreshActivity();
    },
    onError: (error, variables, context) => {
      if (context?.pendingId) {
        mapPages(variables.parentMessageId ?? null, (pages) =>
          removeMessage(pages, context.pendingId as string),
        );
      }

      onError(error);
    },
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

/** Mensagem provisória, com a cara da que o servidor vai devolver. */
function pendingMessage({
  wsId,
  channelId,
  authorId,
  draft,
  parentMessageId,
}: {
  wsId: string;
  channelId: string;
  authorId: string;
  draft: MessageDraft;
  parentMessageId: string | null;
}): Message {
  const now = new Date().toISOString();

  return {
    id: `${PENDING_PREFIX}${now}:${Math.random().toString(36).slice(2, 8)}`,
    workspaceId: wsId,
    channelId,
    authorId,
    body: draft.body as Message['body'],
    bodyText: draft.bodyText,
    parentMessageId,
    replyTo: null,
    replyCount: 0,
    lastReplyAt: null,
    mentions: [],
    reactions: [],
    attachmentIds: draft.attachmentIds ?? [],
    editedAt: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  } as Message;
}
