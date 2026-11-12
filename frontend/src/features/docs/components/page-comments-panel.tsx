import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { queryKeys } from '@/api/keys';
import type { Comment, WorkspaceMemberItem } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage } from '@/api/errors';
import { toast } from '@/components/ui/toast';
import { createPageComment, pageCommentsQuery } from '../api';

export interface PageCommentsPanelProps {
  wsId: string;
  pageId: string;
  canComment: boolean;
  /** Trecho selecionado no editor; o comentário novo nasce ancorado nele. */
  anchor: string;
  members: WorkspaceMemberItem[];
}

function authorName(comment: Comment, members: WorkspaceMemberItem[]): string {
  const id = String(comment.createdBy);

  return members.find((member) => member.userId.id === id)?.userId.name ?? 'Alguém';
}

function when(value: string): string {
  return formatDistanceToNow(new Date(value), { addSuffix: true, locale: ptBR });
}

/**
 * Comentários da página na lateral. Cada um guarda o trecho da página a que se
 * refere (`anchor`), que vem da seleção no editor.
 */
export function PageCommentsPanel({
  wsId,
  pageId,
  canComment,
  anchor,
  members,
}: PageCommentsPanelProps) {
  const client = useQueryClient();
  const [draft, setDraft] = useState('');
  const comments = useInfiniteQuery(pageCommentsQuery(wsId, pageId));
  const threads = comments.data?.pages.flatMap((page) => page.items) ?? [];

  const send = useMutation({
    mutationFn: (text: string) =>
      createPageComment(wsId, pageId, {
        bodyText: text,
        ...(anchor !== '' ? { anchor } : {}),
      }),
    onSuccess: () => {
      setDraft('');
      void client.invalidateQueries({ queryKey: queryKeys.pageComments(wsId, pageId) });
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  return (
    <aside
      aria-label="Comentários"
      className="flex min-w-0 flex-col gap-3 lg:w-[300px] lg:shrink-0"
    >
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        Comentários
      </h2>

      {comments.isPending ? <p className="text-[13px] text-muted">Carregando…</p> : null}

      {!comments.isPending && threads.length === 0 ? (
        <p className="text-[13px] text-muted">Nenhum comentário nesta página.</p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {threads.map((thread) => (
          <li
            key={thread.comment.id}
            className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-3"
          >
            <p className="text-[12.5px]">
              <strong className="font-semibold text-ink">
                {authorName(thread.comment, members)}
              </strong>{' '}
              <span className="text-muted">{when(thread.comment.createdAt)}</span>
            </p>

            {thread.comment.anchor !== null && thread.comment.anchor !== '' ? (
              <p className="rounded-md bg-surface-2 px-2 py-1 text-[12px] text-muted">
                “{thread.comment.anchor}”
              </p>
            ) : null}

            <p className="whitespace-pre-wrap text-[13px] text-body">{thread.comment.bodyText}</p>

            {thread.replies.length > 0 ? (
              <ul className="mt-1 flex flex-col gap-1 border-l border-line pl-2">
                {thread.replies.map((reply) => (
                  <li key={reply.id} className="text-[12.5px] text-body">
                    <strong className="font-semibold text-ink">{authorName(reply, members)}</strong>{' '}
                    {reply.bodyText}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>

      {comments.hasNextPage ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void comments.fetchNextPage();
          }}
        >
          Carregar mais
        </Button>
      ) : null}

      {canComment ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();

            const text = draft.trim();

            if (text !== '') {
              send.mutate(text);
            }
          }}
        >
          {anchor !== '' ? (
            <p className="rounded-md bg-surface-2 px-2 py-1 text-[12px] text-muted">
              Ancorado em “{anchor}”
            </p>
          ) : null}

          <Textarea
            aria-label="Novo comentário"
            rows={2}
            placeholder="Comentar na página…"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
          />

          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={draft.trim() === '' || send.isPending}
          >
            Comentar
          </Button>
        </form>
      ) : null}
    </aside>
  );
}
