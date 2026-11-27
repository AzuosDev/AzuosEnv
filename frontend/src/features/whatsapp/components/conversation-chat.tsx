import { useInfiniteQuery } from '@tanstack/react-query';
import { format, isThisYear, isToday, isYesterday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Bot, CheckCircle2, Info, RotateCcw } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { WaConversationItem, WaMessage, WaProvider, WaTemplate } from '@/api/types';
import { Spinner } from '@/components/ui/spinner';
import { waMessagesQuery } from '../api';
import {
  botPauseUntil,
  canSendFreely,
  contactLabel,
  formatWaNumber,
  groupWaMessagesByDay,
  mergeWaMessagePages,
  reactionsOf,
  visibleMessages,
} from '../whatsapp-model';
import type { WaConversationActions } from '../hooks/use-wa-conversation';
import { Composer } from './composer';
import { MessageBubble } from './message-bubble';

export interface ConversationChatProps {
  wsId: string;
  conversation: WaConversationItem;
  /** Provedor da conexão; null ainda não respondeu. */
  provider: WaProvider | null;
  templates: WaTemplate[];
  actions: WaConversationActions;
  /** Botão de voltar da pilha do celular; ausente no desktop. */
  onBack?: () => void;
  /** Abre o painel do cliente; ausente quando ele já está ao lado. */
  onOpenPanel?: () => void;
}

/** A que distância do topo a rolagem pede o lote anterior. */
const TOP_THRESHOLD_PX = 120;

function dayLabel(day: string): string {
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

/** Conversa aberta: cabeçalho, mensagens por dia e o campo de envio. */
export function ConversationChat({
  wsId,
  conversation,
  provider,
  templates,
  actions,
  onBack,
  onOpenPanel,
}: ConversationChatProps) {
  const query = useInfiniteQuery(waMessagesQuery(wsId, conversation.id));
  const scrollRef = useRef<HTMLDivElement>(null);
  const [replyTo, setReplyTo] = useState<WaMessage | null>(null);
  const all = mergeWaMessagePages(query.data?.pages);
  const reactions = reactionsOf(all);
  const messages = visibleMessages(all);
  const days = groupWaMessagesByDay(messages);
  const byWaId = new Map(
    messages.filter((item) => item.waMessageId).map((item) => [item.waMessageId ?? '', item]),
  );
  const open = canSendFreely(provider, conversation.lastInboundAt);
  const paused = botPauseUntil(conversation.botPausedUntil);
  const name = contactLabel(conversation);
  const lastId = messages[messages.length - 1]?.id;

  useEffect(() => {
    setReplyTo(null);
  }, [conversation.id]);

  // Chegou mensagem nova (ou a conversa mudou): a rolagem vai para o fim.
  useLayoutEffect(() => {
    const node = scrollRef.current;

    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [conversation.id, lastId]);

  const onScroll = (): void => {
    const node = scrollRef.current;

    if (!node || node.scrollTop > TOP_THRESHOLD_PX) {
      return;
    }

    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  };

  return (
    <section
      aria-label={`Conversa com ${name}`}
      className="flex min-h-0 flex-1 flex-col bg-wa-chat"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-wa-line bg-wa-header px-2 py-2 md:px-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar para a lista"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-wa-muted hover:text-wa-text"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : null}

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-wa-text">{name}</p>
          <p className="truncate text-[12px] text-wa-muted">
            {conversation.contact ? formatWaNumber(conversation.contact.waId) : ''}
            {conversation.status === 'closed' ? ' · finalizada' : ''}
          </p>
        </div>

        {conversation.mode === 'human' || paused ? (
          <button
            type="button"
            onClick={() => {
              void actions.backToBot();
            }}
            disabled={actions.pending}
            className="hidden h-10 items-center gap-2 rounded-xl border border-wa-line px-3 text-[13px] font-semibold text-wa-text disabled:opacity-45 md:flex"
          >
            <Bot className="h-4 w-4" aria-hidden="true" />
            Devolver ao bot
          </button>
        ) : null}

        {conversation.status === 'closed' ? (
          <button
            type="button"
            onClick={() => {
              void actions.reopen();
            }}
            disabled={actions.pending}
            className="flex h-11 items-center gap-2 rounded-xl border border-wa-line px-3 text-[13px] font-semibold text-wa-text disabled:opacity-45 md:h-10"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reabrir
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              void actions.close();
            }}
            disabled={actions.pending}
            className="flex h-11 items-center gap-2 rounded-xl border border-wa-line px-3 text-[13px] font-semibold text-wa-text disabled:opacity-45 md:h-10"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Finalizar
          </button>
        )}

        {onOpenPanel ? (
          <button
            type="button"
            onClick={onOpenPanel}
            aria-label="Informações do cliente"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-wa-muted hover:text-wa-text"
          >
            <Info className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : null}
      </header>

      {paused ? (
        <p className="shrink-0 border-b border-wa-line bg-wa-header px-3 py-1.5 text-center text-[12px] text-wa-muted">
          Bot pausado até {format(paused, 'HH:mm')}
        </p>
      ) : null}

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="wa-doodle min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 md:px-4"
      >
        {query.isFetchingNextPage ? (
          <div className="pb-3">
            <Spinner label="Carregando mensagens anteriores" />
          </div>
        ) : null}

        {query.isPending ? <Spinner label="Carregando a conversa" /> : null}

        {!query.isPending && messages.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-wa-muted">
            Nenhuma mensagem nesta conversa.
          </p>
        ) : null}

        {days.map((day) => (
          <div key={day.day} className="flex flex-col gap-1.5">
            <p className="my-2 self-center rounded-lg bg-wa-panel px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-wa-muted">
              {dayLabel(day.day)}
            </p>

            {day.items.map((message, index) => {
              const previous = index === 0 ? undefined : day.items[index - 1];
              // O rabicho fica na primeira bolha da sequência, como no WhatsApp.
              const tail = !previous || previous.direction !== message.direction;

              return (
                <MessageBubble
                  key={message.id}
                  wsId={wsId}
                  conversationId={conversation.id}
                  message={message}
                  quoted={message.replyTo ? (byWaId.get(message.replyTo) ?? null) : null}
                  reactions={message.waMessageId ? (reactions.get(message.waMessageId) ?? []) : []}
                  tail={tail}
                  onReply={setReplyTo}
                />
              );
            })}
          </div>
        ))}
      </div>

      <Composer
        wsId={wsId}
        conversationId={conversation.id}
        windowOpen={open}
        templates={templates}
        replyTo={replyTo}
        disabled={conversation.status === 'closed'}
        onClearReply={() => {
          setReplyTo(null);
        }}
        onSent={() => {
          void query.refetch();
        }}
      />
    </section>
  );
}
