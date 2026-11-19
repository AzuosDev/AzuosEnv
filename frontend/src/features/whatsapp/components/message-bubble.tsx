import { format, parseISO } from 'date-fns';
import { AlertCircle, Bot, Check, CheckCheck, CornerUpLeft } from 'lucide-react';
import type { WaMessage } from '@/api/types';
import { cn } from '@/lib/utils';
import { WA_TYPE_LABEL, checkOf, previewOf } from '../whatsapp-model';
import { WaMediaContent } from './wa-media';

export interface MessageBubbleProps {
  wsId: string;
  conversationId: string;
  message: WaMessage;
  /** Mensagem citada, quando ela está entre as já carregadas. */
  quoted: WaMessage | null;
  /** Emojis que reagiram a esta mensagem. */
  reactions: string[];
  /** Última bolha da sequência do mesmo lado: só ela leva rabicho. */
  tail: boolean;
  onReply: (message: WaMessage) => void;
}

function timeLabel(iso: string): string {
  const date = parseISO(iso);

  return Number.isNaN(date.getTime()) ? '' : format(date, 'HH:mm');
}

/** ✓ enviado, ✓✓ entregue, ✓✓ azul lido, aviso no falhado. */
function StatusCheck({ message }: { message: WaMessage }) {
  const check = checkOf(message);

  if (check === 'none') {
    return null;
  }

  if (check === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 text-danger" title="Falha no envio">
        <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sr-only">Falha no envio</span>
      </span>
    );
  }

  if (check === 'sent') {
    return (
      <>
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sr-only">Enviada</span>
      </>
    );
  }

  return (
    <>
      <CheckCheck
        className={cn('h-3.5 w-3.5', check === 'read' && 'text-wa-read')}
        aria-hidden="true"
      />
      <span className="sr-only">{check === 'read' ? 'Lida' : 'Entregue'}</span>
    </>
  );
}

/** Bolha da conversa: recebida à esquerda, enviada à direita, com rabicho. */
export function MessageBubble({
  wsId,
  conversationId,
  message,
  quoted,
  reactions,
  tail,
  onReply,
}: MessageBubbleProps) {
  const outbound = message.direction === 'outbound';
  const text = message.type === 'text' || message.type === 'template' ? message.body : '';
  const caption = message.media?.caption ?? '';
  const unsupported = message.type === 'unsupported' || message.type === 'contacts';

  return (
    <div className={cn('group flex w-full gap-1.5', outbound ? 'justify-end' : 'justify-start')}>
      {outbound ? (
        <button
          type="button"
          onClick={() => {
            onReply(message);
          }}
          aria-label="Responder a esta mensagem"
          className="hidden h-8 w-8 shrink-0 items-center justify-center self-end rounded-full text-wa-muted opacity-0 hover:text-wa-text group-focus-within:opacity-100 group-hover:opacity-100 md:flex"
        >
          <CornerUpLeft className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}

      <div
        className={cn(
          'relative max-w-[min(85%,34rem)] rounded-lg px-2.5 py-1.5 text-[14px] leading-snug text-wa-text',
          outbound ? 'bg-wa-out' : 'bg-wa-in',
          tail && (outbound ? 'wa-tail-out rounded-tr-none' : 'wa-tail-in rounded-tl-none'),
        )}
      >
        {quoted ? (
          <div
            className={cn(
              'mb-1 rounded-lg border-l-[3px] px-2 py-1 text-[12px]',
              outbound ? 'border-wa-accent bg-wa-quote-out' : 'border-wa-brand bg-wa-quote-in',
            )}
          >
            <span className="font-semibold">
              {quoted.direction === 'outbound' ? 'Você' : 'Cliente'}
            </span>
            <span className="block truncate text-wa-muted">{previewOf(quoted)}</span>
          </div>
        ) : null}

        {message.fromBot ? (
          <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-wa-accent">
            <Bot className="h-3 w-3" aria-hidden="true" />
            Bot
          </span>
        ) : null}

        <WaMediaContent wsId={wsId} conversationId={conversationId} message={message} />

        {text === '' ? null : <p className="whitespace-pre-wrap break-words">{text}</p>}
        {caption === '' || message.type === 'document' ? null : (
          <p className="whitespace-pre-wrap break-words">{caption}</p>
        )}
        {unsupported ? (
          <p className="text-[13px] italic text-wa-muted">{WA_TYPE_LABEL[message.type]}</p>
        ) : null}

        <span className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-wa-muted">
          <time dateTime={message.sentAt}>{timeLabel(message.sentAt)}</time>
          <StatusCheck message={message} />
        </span>

        {reactions.length > 0 ? (
          <span className="absolute -bottom-3 left-2 rounded-full border border-wa-line bg-wa-panel px-1.5 py-0.5 text-[11px]">
            {reactions.join(' ')}
          </span>
        ) : null}
      </div>

      {outbound ? null : (
        <button
          type="button"
          onClick={() => {
            onReply(message);
          }}
          aria-label="Responder a esta mensagem"
          className="hidden h-8 w-8 shrink-0 items-center justify-center self-end rounded-full text-wa-muted opacity-0 hover:text-wa-text group-focus-within:opacity-100 group-hover:opacity-100 md:flex"
        >
          <CornerUpLeft className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      {message.error ? (
        <span className="sr-only">{message.error.message || 'Falha no envio'}</span>
      ) : null}
    </div>
  );
}
