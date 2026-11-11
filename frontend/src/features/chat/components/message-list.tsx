import { format, isThisYear, isToday, isYesterday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Attachment, Message, WorkspaceMemberItem, WorkspaceRole } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { groupMessages } from '../chat-model';
import type { MessageActions } from '../hooks/use-messages';
import { MessageItem } from './message-item';

export interface MessageListProps {
  wsId: string;
  channelId: string;
  messages: Message[];
  members: WorkspaceMemberItem[];
  attachments: Attachment[];
  currentUserId: string | undefined;
  role: WorkspaceRole;
  canWrite: boolean;
  actions: MessageActions;
  /** Rolagem infinita para cima: carrega o lote anterior. */
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  reply?: boolean;
  onOpenThread?: (messageId: string) => void;
  onCreateTask?: (message: Message) => void;
}

/** A que distância do topo a rolagem pede o lote anterior. */
const TOP_THRESHOLD_PX = 120;

export function dayLabel(day: string): string {
  const date = parseISO(day);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  if (isToday(date)) {
    return 'Hoje';
  }

  if (isYesterday(date)) {
    return 'Ontem';
  }

  return format(date, isThisYear(date) ? "EEEE, d 'de' MMMM" : "d 'de' MMMM 'de' yyyy", {
    locale: ptBR,
  });
}

/**
 * Mensagens agrupadas por dia e por autor, com rolagem infinita para cima. O
 * contêiner é o único que rola, e a posição é mantida quando o lote anterior
 * entra em cima.
 */
export function MessageList({
  wsId,
  channelId,
  messages,
  members,
  attachments,
  currentUserId,
  role,
  canWrite,
  actions,
  hasMore,
  loadingMore,
  onLoadMore,
  reply = false,
  onOpenThread,
  onCreateTask,
}: MessageListProps) {
  const box = useRef<HTMLDivElement>(null);
  const days = groupMessages(messages);
  const lastId = messages.at(-1)?.id ?? '';
  const count = messages.length;
  const kept = useRef<{ height: number; count: number }>({ height: 0, count: 0 });
  const pinned = useRef(true);

  // Lote anterior entrou em cima: devolve a rolagem para onde a pessoa estava.
  useLayoutEffect(() => {
    const node = box.current;

    if (!node) {
      return;
    }

    if (count > kept.current.count && kept.current.height > 0 && !pinned.current) {
      node.scrollTop += node.scrollHeight - kept.current.height;
    }

    kept.current = { height: node.scrollHeight, count };
  }, [count]);

  // Mensagem nova no fim: desce, desde que a pessoa já estivesse no fim.
  useEffect(() => {
    const node = box.current;

    if (node && pinned.current) {
      node.scrollTop = node.scrollHeight;
    }
  }, [lastId]);

  return (
    <div
      ref={box}
      role="log"
      aria-label={reply ? 'Respostas da thread' : 'Mensagens do canal'}
      className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-1 md:px-4"
      onScroll={(event) => {
        const node = event.currentTarget;

        pinned.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;

        if (node.scrollTop < TOP_THRESHOLD_PX && hasMore && !loadingMore) {
          onLoadMore();
        }
      }}
    >
      {loadingMore ? (
        <div className="py-2">
          <Spinner label="Carregando mensagens anteriores" />
        </div>
      ) : null}

      {!loadingMore && hasMore ? (
        <div className="flex justify-center py-2">
          <Button variant="ghost" size="sm" onClick={onLoadMore}>
            Carregar anteriores
          </Button>
        </div>
      ) : null}

      {days.map((day) => (
        <section key={day.day} aria-label={dayLabel(day.day)} className="flex flex-col">
          <div className="sticky top-0 z-10 flex items-center gap-2 bg-paper py-1.5">
            <span className="h-px flex-1 bg-line" aria-hidden="true" />
            <span className="rounded-full border border-line px-2 py-0.5 text-[11.5px] text-muted">
              {dayLabel(day.day)}
            </span>
            <span className="h-px flex-1 bg-line" aria-hidden="true" />
          </div>

          {day.blocks.map((block) =>
            block.items.map((message, index) => (
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
                leading={index === 0}
                reply={reply}
                {...(onOpenThread ? { onOpenThread } : {})}
                {...(onCreateTask ? { onCreateTask } : {})}
              />
            )),
          )}
        </section>
      ))}
    </div>
  );
}
