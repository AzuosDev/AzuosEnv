import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CornerDownRight,
  ListPlus,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pencil,
  SmilePlus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import type { Attachment, Message, WorkspaceMemberItem, WorkspaceRole } from '@/api/types';
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
import { saveFile, formatBytes } from '@/features/tasks/components/attachments-section';
import { RichTextView } from '@/features/tasks/components/rich-text-view';
import { cn } from '@/lib/utils';
import {
  QUICK_REACTIONS,
  canDeleteMessage,
  isAuthor,
  memberUser,
  messageReactions,
} from '../chat-model';
import type { MessageActions } from '../hooks/use-messages';
import { MessageComposer } from './message-composer';

export interface MessageItemProps {
  wsId: string;
  channelId: string;
  message: Message;
  members: WorkspaceMemberItem[];
  attachments: Attachment[];
  currentUserId: string | undefined;
  role: WorkspaceRole;
  /** Falso em papel sem permissão de escrever no canal: fica só leitura. */
  canWrite: boolean;
  actions: MessageActions;
  /** Primeira mensagem do bloco: só ela mostra avatar e nome. */
  leading: boolean;
  /** Resposta da thread: sem botão de thread e sem "Criar tarefa". */
  reply?: boolean;
  onOpenThread?: (messageId: string) => void;
  onCreateTask?: (message: Message) => void;
}

function timeOf(iso: string): { short: string; exact: string } {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return { short: '', exact: '' };
  }

  return {
    short: format(date, 'HH:mm', { locale: ptBR }),
    exact: format(date, "d 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR }),
  };
}

function AttachmentChip({ wsId, attachment }: { wsId: string; attachment: Attachment }) {
  const [saving, setSaving] = useState(false);

  return (
    <button
      type="button"
      disabled={saving}
      className="flex min-h-11 max-w-full items-center gap-1.5 rounded-xl border border-line px-2.5 text-[12.5px] text-body hover:bg-surface-2 hover:text-ink md:min-h-9"
      onClick={() => {
        setSaving(true);
        void saveFile(wsId, attachment).finally(() => {
          setSaving(false);
        });
      }}
    >
      <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
      <span className="min-w-0 truncate">{attachment.name}</span>
      <span className="shrink-0 text-muted">{formatBytes(attachment.size)}</span>
      <span className="sr-only">Baixar</span>
    </button>
  );
}

/** Uma mensagem da conversa ou da thread, com reações e as ações de quem pode. */
export function MessageItem({
  wsId,
  channelId,
  message,
  members,
  attachments,
  currentUserId,
  role,
  canWrite,
  actions,
  leading,
  reply = false,
  onOpenThread,
  onCreateTask,
}: MessageItemProps) {
  const [editing, setEditing] = useState(false);
  const author = memberUser(members, message.authorId);
  const reactions = messageReactions(message, currentUserId);
  const stamp = timeOf(message.createdAt);
  const busy = actions.busyId === message.id;
  const mine = isAuthor(message, currentUserId);
  const parentId = message.parentMessageId === null ? null : String(message.parentMessageId);
  const files = message.attachmentIds
    .map((id) => attachments.find((one) => one.id === String(id)))
    .filter((one): one is Attachment => one !== undefined);

  if (editing) {
    return (
      <div className="px-1 py-1.5">
        <MessageComposer
          wsId={wsId}
          channelId={channelId}
          members={members}
          label="Editar a mensagem"
          placeholder="Escreva a mensagem…"
          submitLabel="Salvar"
          pending={busy}
          value={message.body}
          onSubmit={(draft) => {
            actions.edit(message.id, draft, parentId);
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
    <article
      className={cn(
        'group flex min-w-0 gap-2.5 rounded-xl px-1 py-1 hover:bg-surface-2',
        leading && 'mt-2',
      )}
      aria-label={`Mensagem de ${author?.name ?? 'pessoa removida'}`}
    >
      {leading ? (
        <Avatar
          name={author?.name ?? 'Pessoa'}
          src={author?.avatarUrl}
          className={reply ? 'h-7 w-7 shrink-0' : 'h-8 w-8 shrink-0'}
        />
      ) : (
        <span
          className="w-7 shrink-0 self-start pt-0.5 text-right text-[11px] text-muted opacity-0 group-hover:opacity-100 md:w-8"
          aria-hidden="true"
        >
          {stamp.short}
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {leading ? (
          <div className="flex min-w-0 flex-wrap items-center gap-x-2">
            <span className="truncate text-[13px] font-semibold text-ink">
              {author?.name ?? 'Pessoa removida'}
            </span>
            <span className="text-[12px] text-muted" title={stamp.exact}>
              {stamp.short}
            </span>
            {message.editedAt ? <span className="text-[12px] text-muted">· editada</span> : null}
          </div>
        ) : null}

        {!leading && message.editedAt ? (
          <span className="text-[11.5px] text-muted">editada</span>
        ) : null}

        <RichTextView value={message.body} text={message.bodyText} />

        {files.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {files.map((attachment) => (
              <li key={attachment.id} className="min-w-0">
                <AttachmentChip wsId={wsId} attachment={attachment} />
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-center gap-1">
          {reactions.map((reaction) => (
            <button
              key={reaction.emoji}
              type="button"
              disabled={!canWrite || busy}
              aria-pressed={reaction.mine}
              aria-label={`${reaction.emoji} ${String(reaction.count)}`}
              className={cn(
                'flex h-11 items-center gap-1 rounded-full border px-2 text-[12px] md:h-8',
                reaction.mine
                  ? 'border-scene-line bg-scene text-ink'
                  : 'border-line text-body hover:bg-surface-2',
              )}
              onClick={() => {
                actions.react(message.id, reaction.emoji, parentId);
              }}
            >
              <span aria-hidden="true">{reaction.emoji}</span>
              {reaction.count}
            </button>
          ))}

          {!reply && message.replyCount > 0 && onOpenThread ? (
            <button
              type="button"
              className="flex h-11 items-center gap-1.5 rounded-full border border-line px-2.5 text-[12px] font-medium text-accent hover:bg-surface-2 md:h-8"
              onClick={() => {
                onOpenThread(message.id);
              }}
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              {message.replyCount === 1
                ? '1 resposta na thread'
                : `${String(message.replyCount)} respostas na thread`}
            </button>
          ) : null}

          {canWrite ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="nav"
                  size="icon"
                  aria-label="Reagir"
                  className="h-11 w-11 md:h-9 md:w-9 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
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
                        actions.react(message.id, emoji, parentId);
                      }}
                    >
                      <span aria-hidden="true">{emoji}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : null}

          {!reply && canWrite && onOpenThread ? (
            <Button
              variant="nav"
              size="icon"
              aria-label="Responder em thread"
              className="h-11 w-11 md:h-9 md:w-9 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
              onClick={() => {
                onOpenThread(message.id);
              }}
            >
              <CornerDownRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : null}

          {canWrite ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="nav"
                  size="icon"
                  aria-label={`Ações da mensagem de ${author?.name ?? 'pessoa removida'}`}
                  className="h-11 w-11 md:h-9 md:w-9 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100 md:has-[[data-state=open]]:opacity-100"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!reply && onCreateTask ? (
                  <DropdownMenuItem
                    onSelect={() => {
                      onCreateTask(message);
                    }}
                  >
                    <ListPlus className="h-4 w-4" aria-hidden="true" />
                    Criar tarefa
                  </DropdownMenuItem>
                ) : null}

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

                {canDeleteMessage(message, currentUserId, role) ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => {
                        actions.remove(message.id, parentId);
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
      </div>
    </article>
  );
}
