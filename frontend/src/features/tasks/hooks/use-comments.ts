import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useCallback } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { Comment, CommentThread } from '@/api/types';
import { toast } from '@/components/ui/toast';
import {
  assignComment,
  createComment,
  deleteComment,
  reactToComment,
  setCommentResolved,
  updateComment,
} from '../collaboration-api';
import { appendComment, removeComment, replaceComment } from '../comment-model';

interface Page {
  items: CommentThread[];
  nextCursor: string | null;
}

type Pages = InfiniteData<Page, string | undefined>;

export interface NewComment {
  body: Record<string, unknown>;
  bodyText: string;
  parentCommentId?: string;
}

export interface CommentActions {
  create: (input: NewComment) => Promise<void>;
  edit: (commentId: string, draft: { body: Record<string, unknown>; bodyText: string }) => void;
  react: (commentId: string, emoji: string) => void;
  assign: (commentId: string, userId: string | null) => void;
  resolve: (commentId: string, resolved: boolean) => void;
  remove: (commentId: string) => void;
  creating: boolean;
  /** Comentário que está sendo escrito agora, para travar os botões dele. */
  busyId: string | null;
}

/**
 * Escritas dos comentários da tarefa. Toda resposta da API volta como o
 * comentário inteiro, então o cache das threads é remendado na hora e só o
 * detalhe (contagem) e o histórico são invalidados.
 */
export function useComments(wsId: string, customId: string): CommentActions {
  const queryClient = useQueryClient();
  const listKey = queryKeys.comments(wsId, customId);

  const refreshAround = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.task(wsId, customId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.taskActivity(wsId, customId) });
  }, [customId, queryClient, wsId]);

  const mapPages = useCallback(
    (change: (threads: CommentThread[]) => CommentThread[]) => {
      queryClient.setQueryData<Pages>(listKey, (data) =>
        data
          ? { ...data, pages: data.pages.map((page) => ({ ...page, items: change(page.items) })) }
          : data,
      );
    },
    [listKey, queryClient],
  );

  /** O comentário novo entra no fim da última página, como a API o devolveria. */
  const addToCache = useCallback(
    (comment: Comment) => {
      queryClient.setQueryData<Pages>(listKey, (data) => {
        if (!data || data.pages.length === 0) {
          return data;
        }

        const last = data.pages.length - 1;
        const pages = data.pages.map((page, index) =>
          index === last ? { ...page, items: appendComment(page.items, comment) } : page,
        );

        return { ...data, pages };
      });
    },
    [listKey, queryClient],
  );

  const onError = (error: unknown): void => {
    toast.error(errorMessage(error));
  };

  const create = useMutation({
    mutationFn: ({ body, bodyText, parentCommentId }: NewComment) =>
      createComment(wsId, customId, {
        body,
        bodyText,
        ...(parentCommentId ? { parentCommentId } : {}),
      }),
    onSuccess: (comment) => {
      addToCache(comment);

      if (comment.parentCommentId === null) {
        // A thread nova pode não estar na página carregada; o refetch garante.
        void queryClient.invalidateQueries({ queryKey: listKey });
      }

      refreshAround();
    },
    onError,
  });

  const write = useMutation({
    mutationFn: ({ run }: { id: string; run: () => Promise<Comment> }) => run(),
    onSuccess: (comment) => {
      mapPages((threads) => replaceComment(threads, comment));
      refreshAround();
    },
    onError,
  });

  const drop = useMutation({
    mutationFn: (commentId: string) => deleteComment(wsId, commentId),
    onSuccess: (_result, commentId) => {
      mapPages((threads) => removeComment(threads, commentId));
      refreshAround();
      toast.success('Comentário excluído.');
    },
    onError,
  });

  const busyId = write.isPending ? write.variables.id : drop.isPending ? drop.variables : null;

  return {
    create: async (input) => {
      try {
        await create.mutateAsync(input);
      } catch {
        // O toast já saiu no onError.
      }
    },
    edit: (commentId, draft) => {
      write.mutate({ id: commentId, run: () => updateComment(wsId, commentId, draft) });
    },
    react: (commentId, emoji) => {
      write.mutate({ id: commentId, run: () => reactToComment(wsId, commentId, emoji) });
    },
    assign: (commentId, userId) => {
      write.mutate({ id: commentId, run: () => assignComment(wsId, commentId, userId) });
    },
    resolve: (commentId, resolved) => {
      write.mutate({ id: commentId, run: () => setCommentResolved(wsId, commentId, resolved) });
    },
    remove: (commentId) => {
      drop.mutate(commentId);
    },
    creating: create.isPending,
    busyId: busyId ?? null,
  };
}
