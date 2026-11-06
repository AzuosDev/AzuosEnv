import type { Comment, CommentThread, WorkspaceRole } from '@/api/types';

/** Emojis oferecidos no botão de reagir. */
export const QUICK_REACTIONS = ['👍', '🎉', '👀', '✅', '❤️', '🚀'] as const;

interface Page {
  items: CommentThread[];
}

/**
 * Threads das páginas carregadas, da mais recente para a mais antiga. A API
 * devolve as raízes em ordem crescente de id; a tela mostra ao contrário, com
 * o editor em cima.
 */
export function mergeThreadPages(pages: Page[] | undefined): CommentThread[] {
  return (pages ?? []).flatMap((page) => page.items).reverse();
}

export interface ReactionState {
  emoji: string;
  count: number;
  /** Se o usuário autenticado é um dos que reagiram. */
  mine: boolean;
}

export function reactionStates(comment: Comment, userId: string | undefined): ReactionState[] {
  return comment.reactions
    .filter((reaction) => reaction.userIds.length > 0)
    .map((reaction) => ({
      emoji: reaction.emoji,
      count: reaction.userIds.length,
      mine: userId ? reaction.userIds.some((id) => String(id) === userId) : false,
    }));
}

export function isAuthor(comment: Comment, userId: string | undefined): boolean {
  return Boolean(userId) && String(comment.createdBy) === userId;
}

/** Editar é só do autor; excluir também aceita quem administra o workspace. */
export function canDeleteComment(
  comment: Comment,
  userId: string | undefined,
  role: WorkspaceRole,
): boolean {
  return isAuthor(comment, userId) || role === 'owner' || role === 'admin';
}

/** Troca um comentário (raiz ou resposta) em todas as threads carregadas. */
export function replaceComment(threads: CommentThread[], comment: Comment): CommentThread[] {
  return threads.map((thread) => {
    if (thread.comment.id === comment.id) {
      return { ...thread, comment };
    }

    if (!thread.replies.some((reply) => reply.id === comment.id)) {
      return thread;
    }

    return {
      ...thread,
      replies: thread.replies.map((reply) => (reply.id === comment.id ? comment : reply)),
    };
  });
}

/** Tira o comentário das threads; excluir a raiz tira a thread inteira. */
export function removeComment(threads: CommentThread[], commentId: string): CommentThread[] {
  return threads
    .filter((thread) => thread.comment.id !== commentId)
    .map((thread) =>
      thread.replies.some((reply) => reply.id === commentId)
        ? { ...thread, replies: thread.replies.filter((reply) => reply.id !== commentId) }
        : thread,
    );
}

/**
 * Põe o comentário novo no fim, na mesma ordem crescente em que a API devolve
 * as threads; quem inverte para a tela é o mergeThreadPages.
 */
export function appendComment(threads: CommentThread[], comment: Comment): CommentThread[] {
  const parentId = comment.parentCommentId ? String(comment.parentCommentId) : null;

  if (!parentId) {
    return [...threads, { comment, replies: [] }];
  }

  return threads.map((thread) =>
    thread.comment.id === parentId ? { ...thread, replies: [...thread.replies, comment] } : thread,
  );
}

/** Quantos comentários (raízes e respostas) estão carregados. */
export function countComments(threads: CommentThread[]): number {
  return threads.reduce((total, thread) => total + 1 + thread.replies.length, 0);
}
