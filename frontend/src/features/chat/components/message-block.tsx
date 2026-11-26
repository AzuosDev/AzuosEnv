import type { Attachment, Message, WorkspaceMemberItem, WorkspaceRole } from '@/api/types';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { AUTHOR_TONE_COUNT, authorToneIndex, isAuthor, memberUser } from '../chat-model';
import type { ChannelReceipts, MessageBlock as Block } from '../chat-model';
import type { MessageActions } from '../hooks/use-messages';
import { MessageItem } from './message-item';

export interface MessageBlockProps {
  wsId: string;
  channelId: string;
  /** Mensagens seguidas do mesmo autor: todas na mesma bolha. */
  block: Block;
  members: WorkspaceMemberItem[];
  attachments: Attachment[];
  currentUserId: string | undefined;
  role: WorkspaceRole;
  canWrite: boolean;
  actions: MessageActions;
  /** Conversa de mais de duas pessoas: cada autor ganha nome e tonalidade. */
  group?: boolean;
  /** Leituras do canal: dão o tique de entrega das minhas mensagens. */
  receipts?: ChannelReceipts;
  reply?: boolean;
  onOpenThread?: (messageId: string) => void;
  onCreateTask?: (message: Message) => void;
  onReply?: (message: Message) => void;
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

/**
 * Bloco da conversa: avatar e nome uma vez só e uma única bolha com todas as
 * mensagens seguidas do mesmo autor. Cada mensagem continua sendo um artigo
 * com a sua hora, o seu tique e as suas ações.
 */
export function MessageBlock({
  wsId,
  channelId,
  block,
  members,
  attachments,
  currentUserId,
  role,
  canWrite,
  actions,
  group = false,
  receipts,
  reply = false,
  onOpenThread,
  onCreateTask,
  onReply,
}: MessageBlockProps) {
  const first = block.items[0];

  if (!first) {
    return null;
  }

  const author = memberUser(members, first.authorId);
  const mine = isAuthor(first, currentUserId);
  const tone = AUTHOR_TONES[authorToneIndex(first.authorId, AUTHOR_TONE_COUNT)] ?? AUTHOR_TONES[0];

  return (
    <div
      data-message-block={block.id}
      className={cn(
        'mt-2 flex min-w-0 items-start gap-2 px-1',
        mine ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      <Avatar
        name={author?.name ?? 'Pessoa'}
        src={author?.avatarUrl}
        className={reply ? 'h-7 w-7 shrink-0' : 'h-8 w-8 shrink-0'}
      />

      <div
        className={cn(
          'flex min-w-0 max-w-[85%] flex-col md:max-w-[75%] lg:max-w-[66%]',
          // A edição abre o editor dentro da bolha e precisa da largura toda.
          'has-[[data-editing=true]]:max-w-full has-[[data-editing=true]]:flex-1',
          mine ? 'items-end' : 'items-start',
        )}
      >
        <div
          className={cn(
            'min-w-0 max-w-full rounded-2xl border px-3 py-2',
            mine
              ? 'rounded-tr-sm border-scene-line bg-scene'
              : 'rounded-tl-sm border-line bg-surface',
            'has-[[data-editing=true]]:w-full',
          )}
        >
          <span
            className={cn(
              'mb-0.5 block truncate text-[12.5px] font-semibold',
              group && !mine ? tone : 'text-ink',
            )}
          >
            {author?.name ?? 'Pessoa removida'}
          </span>

          {block.items.map((message, index) => (
            <MessageItem
              key={message.id}
              wsId={wsId}
              channelId={channelId}
              message={message}
              members={members}
              attachments={attachments}
              currentUserId={currentUserId}
              role={role}
              canWrite={canWrite}
              actions={actions}
              first={index === 0}
              mine={mine}
              {...(receipts ? { receipts } : {})}
              reply={reply}
              {...(onOpenThread ? { onOpenThread } : {})}
              {...(onCreateTask ? { onCreateTask } : {})}
              {...(onReply ? { onReply } : {})}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
