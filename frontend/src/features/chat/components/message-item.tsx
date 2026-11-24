import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Check,
  CheckCheck,
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
  AUTHOR_TONE_COUNT,
  QUICK_REACTIONS,
  authorToneIndex,
  canDeleteMessage,
  isAuthor,
  memberUser,
  messageReactions,
  messageReceipt,
} from '../chat-model';
import type { ChannelReceipts, MessageReceipt } from '../chat-model';
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
  /** Conversa de mais de duas pessoas: cada autor ganha nome e tonalidade. */
  group?: boolean;
  /** Leituras do canal: dão o tique de entrega das minhas mensagens. */
  receipts?: ChannelReceipts;
  /** Resposta da thread: sem botão de thread e sem "Criar tarefa". */
  reply?: boolean;
  onOpenThread?: (messageId: string) => void;
  onCreateTask?: (message: Message) => void;
}

/** Tons do nome de quem escreve no grupo, todos tokens com contraste AA. */
const AUTHOR_TONES = [
  'text-tone-1',
  'text-tone-2',
  'text-tone-3',
  'text-tone-4',
  'text-tone-5',
  'text-tone-6',
] as const;

function receiptTitle(receipt: MessageReceipt | null): string {
  if (!receipt) {
    return '';
  }

  if (receipt.tick === 'sent') {
    return 'Enviada';
  }

  if (receipt.tick === 'delivered') {
    return `Entregue a ${String(receipt.readBy)} ${receipt.readBy === 1 ? 'pessoa' : 'pessoas'}`;
  }

  return receipt.tick === 'read' ? 'Lida por todos' : `Lida por ${String(receipt.readBy)} pessoas`;
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
      className="flex min-h-11 max-w-full items-center gap-1.5 rounded-xl border border-line bg-paper/40 px-2.5 text-[12.5px] text-body hover:bg-surface-2 hover:text-ink md:min-h-9"
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

/**
 * Uma mensagem da conversa ou da thread, em bolha: a minha à direita e as dos
 * outros à esquerda, com reações e as ações de quem pode.
 */
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
  group = false,
  receipts,
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
  const tone =
    AUTHOR_TONES[authorToneIndex(message.authorId, AUTHOR_TONE_COUNT)] ?? AUTHOR_TONES[0];
  const receipt = mine
    ? messageReceipt(message, receipts?.readers ?? [], currentUserId, receipts?.others ?? [])
    : null;
  const receiptLabel = receiptTitle(receipt);
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
        'group flex min-w-0 items-start gap-2 px-1 py-0.5',
        mine ? 'flex-row-reverse' : 'flex-row',
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
        <span className={cn('shrink-0', reply ? 'w-7' : 'w-8')} aria-hidden="true" />
      )}

      <div
        className={cn(
          'flex min-w-0 max-w-[85%] flex-col gap-1 md:max-w-[75%] lg:max-w-[66%]',
          mine ? 'items-end' : 'items-start',
        )}
      >
        <div
          className={cn(
            'min-w-0 max-w-full rounded-2xl border px-3 py-2',
            mine ? 'border-scene-line bg-scene' : 'border-line bg-surface',
            leading && (mine ? 'rounded-tr-sm' : 'rounded-tl-sm'),
          )}
        >
          {leading ? (
            <span
              className={cn(
                'mb-0.5 block truncate text-[12.5px] font-semibold',
                group && !mine ? tone : 'text-ink',
              )}
            >
              {author?.name ?? 'Pessoa removida'}
            </span>
          ) : null}

          <RichTextView value={message.body} text={message.bodyText} />

          {files.length > 0 ? (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {files.map((attachment) => (
                <li key={attachment.id} className="min-w-0">
                  <AttachmentChip wsId={wsId} attachment={attachment} />
                </li>
              ))}
            </ul>
          ) : null}

          <span className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-muted">
            {message.editedAt ? <span>editada ·</span> : null}
            <time dateTime={message.createdAt} title={stamp.exact}>
              {stamp.short}
            </time>

            {receipt ? (
              <span
                role="img"
                aria-label={receiptLabel}
                title={receiptLabel}
                className={receipt.tick === 'read' ? 'text-accent' : 'text-muted'}
              >
                {receipt.tick === 'sent' ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </span>
            ) : null}
          </span>
        </div>

        <div
          className={cn(
            'flex flex-wrap items-center gap-1',
            mine ? 'flex-row-reverse' : 'flex-row',
          )}
        >
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
              <PopoverContent align={mine ? 'end' : 'start'} className="w-auto">
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
              <DropdownMenuContent align={mine ? 'start' : 'end'}>
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
