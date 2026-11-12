import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Check,
  CornerDownRight,
  MoreHorizontal,
  Pencil,
  SmilePlus,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { useState } from 'react';
import type { Comment, CommentThread, WorkspaceMemberItem, WorkspaceRole } from '@/api/types';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StatusPill } from '@/components/ui/status-pill';
import { cn } from '@/lib/utils';
import { QUICK_REACTIONS, canDeleteComment, isAuthor, reactionStates } from '../comment-model';
import type { CommentActions } from '../hooks/use-comments';
import { CommentComposer } from './comment-composer';
import { RichTextView } from './rich-text-view';
import { PersonPicker } from './task-pickers';

export interface CommentItemProps {
  wsId: string;
  comment: Comment;
  members: WorkspaceMemberItem[];
  currentUserId: string | undefined;
  role: WorkspaceRole;
  /** Falso em papel sem permissão de comentar: fica só leitura. */
  canWrite: boolean;
  actions: CommentActions;
  /** Resposta não abre thread nem recebe botão de responder. */
  reply?: boolean;
}

function personOf(members: WorkspaceMemberItem[], id: string | null) {
  return members.find((member) => member.userId.id === String(id ?? ''))?.userId;
}

function when(iso: string): { relative: string; exact: string } {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return { relative: '', exact: '' };
  }

  return {
    relative: formatDistanceToNow(date, { locale: ptBR, addSuffix: true }),
    exact: format(date, "d 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR }),
  };
}

/** Um comentário: autor, texto, reações e as ações de quem pode mexer nele. */
export function CommentItem({
  wsId,
  comment,
  members,
  currentUserId,
  role,
  canWrite,
  actions,
  reply = false,
}: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const author = personOf(members, comment.createdBy);
  const assignee = personOf(members, comment.assigneeId);
  const reactions = reactionStates(comment, currentUserId);
  const stamp = when(comment.createdAt);
  const resolved = comment.resolvedAt !== null;
  const busy = actions.busyId === comment.id;
  const mine = isAuthor(comment, currentUserId);

  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <CommentComposer
          wsId={wsId}
          members={members}
          label="Editar o comentário"
          placeholder="Escreva o comentário…"
          submitLabel="Salvar"
          pending={busy}
          value={comment.body}
          onSubmit={(draft) => {
            actions.edit(comment.id, draft);
            setEditing(false);
          }}
          onCancel={() => {
            setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <article className={cn('flex min-w-0 gap-2.5', resolved && 'opacity-70')}>
      <Avatar
        name={author?.name ?? 'Pessoa'}
        src={author?.avatarUrl}
        className={reply ? 'h-7 w-7 shrink-0' : 'h-8 w-8 shrink-0'}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-[13px] font-semibold text-ink">
            {author?.name ?? 'Pessoa removida'}
          </span>
          <span className="text-[12px] text-muted" title={stamp.exact}>
            {stamp.relative}
          </span>
          {comment.editedAt ? <span className="text-[12px] text-muted">· editado</span> : null}
          {resolved ? <StatusPill tone="success">Resolvido</StatusPill> : null}

          {canWrite ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="nav"
                  size="icon"
                  aria-label={`Ações do comentário de ${author?.name ?? 'pessoa removida'}`}
                  className="ml-auto h-11 w-11 md:h-9 md:w-9"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {mine ? (
                  <DropdownMenuItem
                    onSelect={() => {
                      setEditing(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Editar
                  </DropdownMenuItem>
                ) : null}

                <DropdownMenuItem
                  onSelect={() => {
                    actions.resolve(comment.id, !resolved);
                  }}
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  {resolved ? 'Reabrir' : 'Resolver'}
                </DropdownMenuItem>

                {canDeleteComment(comment, currentUserId, role) ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => {
                        actions.remove(comment.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Excluir
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <RichTextView value={comment.body} text={comment.bodyText} />

        <div className="flex flex-wrap items-center gap-1">
          {reactions.map((reaction) => (
            <button
              key={reaction.emoji}
              type="button"
              disabled={!canWrite || busy}
              aria-pressed={reaction.mine}
              aria-label={`${reaction.emoji} ${String(reaction.count)}`}
              className={cn(
                'flex h-11 items-center gap-1 rounded-full border px-2 text-[12px] md:h-9',
                reaction.mine
                  ? 'border-scene-line bg-scene text-ink'
                  : 'border-line text-body hover:bg-surface-2',
              )}
              onClick={() => {
                actions.react(comment.id, reaction.emoji);
              }}
            >
              <span aria-hidden="true">{reaction.emoji}</span>
              {reaction.count}
            </button>
          ))}

          {canWrite ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="nav"
                  size="icon"
                  aria-label="Reagir"
                  className="h-11 w-11 md:h-9 md:w-9"
                >
                  <SmilePlus className="h-4 w-4" aria-hidden="true" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto">
                <div className="flex gap-1">
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      aria-label={`Reagir com ${emoji}`}
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-base hover:bg-surface-2 md:h-10 md:w-10"
                      onClick={() => {
                        actions.react(comment.id, emoji);
                      }}
                    >
                      <span aria-hidden="true">{emoji}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : null}

          {canWrite ? (
            <PersonPicker
              members={members}
              value={comment.assigneeId === null ? null : String(comment.assigneeId)}
              emptyLabel="Sem responsável"
              onSelect={(userId) => {
                actions.assign(comment.id, userId);
              }}
            >
              <button
                type="button"
                aria-label="Responsável pelo comentário"
                className="flex h-11 items-center gap-1 rounded-full border border-line px-2 text-[12px] text-body hover:bg-surface-2 hover:text-ink md:h-9"
              >
                <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                {assignee ? assignee.name : 'Atribuir'}
              </button>
            </PersonPicker>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export interface CommentThreadItemProps extends Omit<CommentItemProps, 'comment' | 'reply'> {
  thread: CommentThread;
}

/** Comentário raiz com as respostas e o editor de resposta da thread. */
export function CommentThreadItem({ thread, ...props }: CommentThreadItemProps) {
  const [replying, setReplying] = useState(false);

  return (
    <li className="flex flex-col gap-3 border-b border-line/60 pb-4 last:border-b-0">
      <CommentItem {...props} comment={thread.comment} />

      {thread.replies.length > 0 ? (
        <ul className="ml-4 flex flex-col gap-3 border-l border-line pl-3 md:ml-5">
          {thread.replies.map((item) => (
            <li key={item.id} className="min-w-0">
              <CommentItem {...props} comment={item} reply />
            </li>
          ))}
        </ul>
      ) : null}

      {props.canWrite && !replying ? (
        <Button
          variant="nav"
          size="sm"
          className="self-start"
          onClick={() => {
            setReplying(true);
          }}
        >
          <CornerDownRight className="h-3.5 w-3.5" aria-hidden="true" />
          Responder
        </Button>
      ) : null}

      {replying ? (
        <div className="ml-4 md:ml-5">
          <CommentComposer
            wsId={props.wsId}
            members={props.members}
            label={`Responder a ${thread.comment.bodyText.slice(0, 40)}`}
            placeholder="Escreva a resposta…"
            submitLabel="Responder"
            pending={props.actions.creating}
            showToolbar={false}
            onSubmit={(draft) => {
              void props.actions
                .create({ ...draft, parentCommentId: thread.comment.id })
                .then(() => {
                  setReplying(false);
                });
            }}
            onCancel={() => {
              setReplying(false);
            }}
          />
        </div>
      ) : null}
    </li>
  );
}
