import { Link } from '@tanstack/react-router';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight } from 'lucide-react';
import type { Comment, WorkspaceMemberItem } from '@/api/types';
import { Avatar } from '@/components/ui/avatar';
import { StatusPill } from '@/components/ui/status-pill';
import { RichTextView } from '@/features/tasks/components/rich-text-view';

export interface CommentFeedProps {
  wsId: string;
  items: Comment[];
  members: WorkspaceMemberItem[];
}

/**
 * Lista de comentários do Inbox (respostas e atribuídos). O link abre a tarefa
 * pelo id, que a rota do painel aceita no lugar do customId.
 */
export function CommentFeed({ wsId, items, members }: CommentFeedProps) {
  return (
    <ul className="flex flex-col rounded-2xl border border-line bg-surface">
      {items.map((comment) => {
        const author = members.find((member) => member.userId.id === comment.createdBy)?.userId;
        const when = new Date(comment.createdAt);

        return (
          <li
            key={comment.id}
            className="flex items-start gap-3 border-b border-line px-3 py-3 last:border-b-0"
          >
            <Avatar
              name={author?.name ?? 'Alguém'}
              src={author?.avatarUrl}
              className="mt-0.5 h-8 w-8 shrink-0"
            />

            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13.5px] font-semibold text-ink">
                  {author?.name ?? 'Alguém'}
                </span>
                <span className="text-[12px] text-muted">
                  {Number.isNaN(when.getTime())
                    ? ''
                    : formatDistanceToNow(when, { locale: ptBR, addSuffix: true })}
                </span>
                {comment.resolvedAt ? <StatusPill tone="success">Resolvido</StatusPill> : null}
              </div>

              <RichTextView value={comment.body} text={comment.bodyText} className="text-[13px]" />

              {comment.entityType === 'task' ? (
                <Link
                  to="/w/$wsId/t/$customId"
                  params={{ wsId, customId: comment.entityId }}
                  className="flex min-h-11 items-center gap-1.5 text-[12.5px] text-accent md:min-h-0"
                >
                  Abrir a tarefa
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
