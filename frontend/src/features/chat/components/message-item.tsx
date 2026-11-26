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
  Reply,
  SmilePlus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import type { Attachment, Message, WorkspaceMemberItem, WorkspaceRole } from '@/api/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/components/ui/toast';
import { saveFile, formatBytes } from '@/features/tasks/components/attachments-section';
import { RichTextView } from '@/features/tasks/components/rich-text-view';
import { cn } from '@/lib/utils';
import {
  QUICK_REACTIONS,
  canDeleteMessage,
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
  /** Primeira mensagem da bolha: as seguintes ganham o filete de separação. */
  first: boolean;
  /** Bolha do usuário autenticado: muda o lado das ações e o tom do filete. */
  mine: boolean;
  /** Leituras do canal: dão o tique de entrega das minhas mensagens. */
  receipts?: ChannelReceipts;
  /** Resposta da thread: sem botão de thread e sem "Criar tarefa". */
  reply?: boolean;
  onOpenThread?: (messageId: string) => void;
  onCreateTask?: (message: Message) => void;
  /** Cita esta mensagem no editor da conversa, no estilo do WhatsApp. */
  onReply?: (message: Message) => void;
}

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

/**
 * Leva a conversa até a mensagem citada e a destaca por um instante. Ela pode
 * estar numa página ainda não carregada: aí só avisa.
 */
function jumpToMessage(messageId: string): void {
  const node = document.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);

  if (!node) {
    toast('A mensagem citada ainda não está carregada. Role para cima para vê-la.');

    return;
  }

  node.scrollIntoView({ block: 'center', behavior: 'smooth' });
  node.dataset.highlight = 'true';
  window.setTimeout(() => {
    delete node.dataset.highlight;
  }, 1600);
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
 * Uma mensagem dentro da bolha do bloco: texto, anexos, hora, tique e reações.
 * Avatar, nome e a borda da bolha são do bloco, porque mensagens seguidas do
 * mesmo autor dividem a mesma bolha. No desktop as ações flutuam ao lado da
 * bolha, para não alargar mensagem curta; no celular ficam embaixo.
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
  first,
  mine,
  receipts,
  reply = false,
  onOpenThread,
  onCreateTask,
  onReply,
}: MessageItemProps) {
  const [editing, setEditing] = useState(false);
  const author = memberUser(members, message.authorId);
  const reactions = messageReactions(message, currentUserId);
  const stamp = timeOf(message.createdAt);
  const busy = actions.busyId === message.id;
  const parentId = message.parentMessageId === null ? null : String(message.parentMessageId);
  const receipt = mine
    ? messageReceipt(message, receipts?.readers ?? [], currentUserId, receipts?.others ?? [])
    : null;
  const receiptLabel = receiptTitle(receipt);
  const files = message.attachmentIds
    .map((id) => attachments.find((one) => one.id === String(id)))
    .filter((one): one is Attachment => one !== undefined);
  const divider = first
    ? ''
    : cn('mt-1.5 border-t pt-1.5', mine ? 'border-scene-line' : 'border-line');
  const threadCount = !reply && message.replyCount > 0 && onOpenThread;
  const quote = message.replyTo;
  const quotedAuthor = quote ? memberUser(members, quote.authorId) : null;

  if (editing) {
    return (
      <div data-editing="true" className={cn('w-full py-1', divider)}>
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
      data-message-id={message.id}
      className={cn(
        'group relative flex min-w-0 flex-col scroll-mt-16 rounded-lg',
        'data-[highlight=true]:ring-2 data-[highlight=true]:ring-accent',
        divider,
      )}
      aria-label={`Mensagem de ${author?.name ?? 'pessoa removida'}`}
    >
      {quote ? (
        <button
          type="button"
          className="mb-1 min-w-0 max-w-full rounded-lg border-l-2 border-accent bg-paper/40 px-2 py-1 text-left hover:bg-surface-2"
          aria-label={`Ir para a mensagem de ${quotedAuthor?.name ?? 'pessoa removida'}`}
          onClick={() => {
            jumpToMessage(String(quote.messageId));
          }}
        >
          <span className="block truncate text-[12px] font-semibold text-accent">
            {quotedAuthor?.name ?? 'Pessoa removida'}
          </span>
          <span className="block truncate text-[12px] text-muted">{quote.text}</span>
        </button>
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

      {reactions.length > 0 || threadCount ? (
        <div
          className={cn(
            'mt-1 flex flex-wrap items-center gap-1',
            mine ? 'justify-end' : 'justify-start',
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

          {threadCount && onOpenThread ? (
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
        </div>
      ) : null}

      {canWrite ? (
        <div
          className={cn(
            // Fora do fluxo: a bolha fica do tamanho da mensagem, e as ações
            // flutuam na folga ao lado dela. No celular cabe só o menu.
            'absolute top-0 flex items-center gap-1',
            mine ? 'right-full mr-2 md:mr-4' : 'left-full ml-2 md:ml-4',
          )}
        >
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="nav"
                size="icon"
                aria-label="Reagir"
                className="hidden md:inline-flex md:h-9 md:w-9 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100 md:has-[[data-state=open]]:opacity-100"
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

          {onReply ? (
            <Button
              variant="nav"
              size="icon"
              aria-label="Responder citando"
              className="hidden md:inline-flex md:h-9 md:w-9 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
              onClick={() => {
                onReply(message);
              }}
            >
              <Reply className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : null}

          {!reply && onOpenThread ? (
            <Button
              variant="nav"
              size="icon"
              aria-label="Responder em thread"
              className="hidden md:inline-flex md:h-9 md:w-9 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
              onClick={() => {
                onOpenThread(message.id);
              }}
            >
              <CornerDownRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : null}

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
              <div className="flex gap-1 px-1 pb-1 md:hidden">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    aria-label={`Reagir com ${emoji}`}
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-base hover:bg-surface-2"
                    onClick={() => {
                      actions.react(message.id, emoji, parentId);
                    }}
                  >
                    <span aria-hidden="true">{emoji}</span>
                  </button>
                ))}
              </div>

              {onReply ? (
                <DropdownMenuItem
                  className="md:hidden"
                  onSelect={() => {
                    onReply(message);
                  }}
                >
                  <Reply className="h-4 w-4" aria-hidden="true" />
                  Responder citando
                </DropdownMenuItem>
              ) : null}

              {!reply && onOpenThread ? (
                <DropdownMenuItem
                  className="md:hidden"
                  onSelect={() => {
                    onOpenThread(message.id);
                  }}
                >
                  <CornerDownRight className="h-4 w-4" aria-hidden="true" />
                  Responder em thread
                </DropdownMenuItem>
              ) : null}

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
        </div>
      ) : null}
    </article>
  );
}
