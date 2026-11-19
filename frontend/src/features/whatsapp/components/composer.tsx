import { useQuery } from '@tanstack/react-query';
import { Paperclip, Send, X, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { WaMessage, WaTemplate } from '@/api/types';
import { SelectNative } from '@/components/ui/select-native';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { sendWaMedia, sendWaTemplate, sendWaText, waQuickRepliesQuery } from '../api';
import { previewOf, quickReplyTerm } from '../whatsapp-model';

export interface ComposerProps {
  wsId: string;
  conversationId: string;
  /** Falso quando a janela de 24 h fechou: só template é aceito. */
  windowOpen: boolean;
  templates: WaTemplate[];
  /** Mensagem citada na resposta; null quando não há. */
  replyTo: WaMessage | null;
  onClearReply: () => void;
  onSent: () => void;
  disabled?: boolean;
}

/** Campo de envio: texto com "/" para resposta rápida, anexo e enviar. */
export function Composer({
  wsId,
  conversationId,
  windowOpen,
  templates,
  replyTo,
  onClearReply,
  onSent,
  disabled = false,
}: ComposerProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const term = quickReplyTerm(text);
  const quickReplies = useQuery({
    ...waQuickRepliesQuery(wsId, conversationId, term ?? ''),
    enabled: windowOpen && term !== null,
  });
  const suggestions = term === null ? [] : (quickReplies.data ?? []);

  useEffect(() => {
    setText('');
  }, [conversationId]);

  const send = async (): Promise<void> => {
    const body = text.trim();

    if (body === '' || sending) {
      return;
    }

    setSending(true);

    try {
      await sendWaText(wsId, conversationId, {
        text: body,
        ...(replyTo?.waMessageId ? { replyTo: replyTo.waMessageId } : {}),
      });
      setText('');
      onClearReply();
      onSent();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSending(false);
    }
  };

  const sendFile = async (file: File): Promise<void> => {
    setSending(true);

    try {
      await sendWaMedia(wsId, conversationId, file, {
        ...(text.trim() === '' ? {} : { caption: text.trim() }),
        ...(replyTo?.waMessageId ? { replyTo: replyTo.waMessageId } : {}),
      });
      setText('');
      onClearReply();
      onSent();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSending(false);
    }
  };

  if (!windowOpen) {
    return (
      <TemplateComposer
        wsId={wsId}
        conversationId={conversationId}
        templates={templates}
        onSent={onSent}
        disabled={disabled}
      />
    );
  }

  return (
    <div className="shrink-0 border-t border-wa-line bg-wa-header px-2 py-2 pb-[max(env(safe-area-inset-bottom),8px)] md:px-3">
      {replyTo ? (
        <div className="mb-2 flex items-center gap-2 rounded-lg border-l-[3px] border-wa-accent bg-wa-quote-in px-2 py-1.5">
          <span className="min-w-0 flex-1 truncate text-[12px] text-wa-muted">
            Respondendo: {previewOf(replyTo)}
          </span>
          <button
            type="button"
            onClick={onClearReply}
            aria-label="Cancelar a resposta"
            className="flex h-11 w-11 items-center justify-center rounded-full text-wa-muted hover:text-wa-text md:h-8 md:w-8"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {suggestions.length > 0 ? (
        <ul className="mb-2 max-h-48 overflow-y-auto rounded-lg border border-wa-line bg-wa-panel">
          {suggestions.map((reply) => (
            <li key={reply.id}>
              <button
                type="button"
                onClick={() => {
                  setText(reply.rendered || reply.text);
                  areaRef.current?.focus();
                }}
                className="flex min-h-11 w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-wa-header"
              >
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-wa-text">
                  <Zap className="h-3.5 w-3.5 text-wa-accent" aria-hidden="true" />/{reply.shortcut}{' '}
                  · {reply.title}
                </span>
                <span className="line-clamp-2 text-[12px] text-wa-muted">
                  {reply.rendered || reply.text}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-end gap-1.5">
        <input
          ref={fileRef}
          type="file"
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];

            event.target.value = '';

            if (file) {
              void sendFile(file);
            }
          }}
        />
        <button
          type="button"
          onClick={() => {
            fileRef.current?.click();
          }}
          disabled={disabled || sending}
          aria-label="Anexar arquivo"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-wa-muted hover:text-wa-text disabled:opacity-45 md:h-10 md:w-10"
        >
          <Paperclip className="h-5 w-5" aria-hidden="true" />
        </button>

        <label className="min-w-0 flex-1">
          <span className="sr-only">Mensagem</span>
          <textarea
            ref={areaRef}
            value={text}
            rows={1}
            placeholder='Mensagem ou "/" para resposta rápida'
            disabled={disabled || sending}
            onChange={(event) => {
              setText(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            className={cn(
              'max-h-32 min-h-11 w-full resize-none rounded-2xl border border-wa-line bg-wa-panel px-3 py-2.5 text-wa-text outline-none placeholder:text-wa-muted disabled:opacity-45 md:min-h-10 md:py-2',
            )}
          />
        </label>

        <button
          type="button"
          onClick={() => {
            void send();
          }}
          disabled={disabled || sending || text.trim() === ''}
          aria-label="Enviar"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-wa-accent text-wa-panel disabled:opacity-45 md:h-10 md:w-10"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

interface TemplateComposerProps {
  wsId: string;
  conversationId: string;
  templates: WaTemplate[];
  onSent: () => void;
  disabled: boolean;
}

/**
 * Janela de 24 h fechada: a Meta só aceita template aprovado, então o campo dá
 * lugar à escolha do template e às variáveis do corpo.
 */
function TemplateComposer({
  wsId,
  conversationId,
  templates,
  onSent,
  disabled,
}: TemplateComposerProps) {
  const [name, setName] = useState('');
  const [variables, setVariables] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const chosen = templates.find((template) => template.name === name) ?? null;

  const send = async (): Promise<void> => {
    if (!chosen || sending) {
      return;
    }

    setSending(true);

    try {
      await sendWaTemplate(wsId, conversationId, {
        name: chosen.name,
        language: chosen.language,
        variables: variables.slice(0, chosen.variables),
      });
      setName('');
      setVariables([]);
      onSent();
      toast.success('Template enviado.');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="shrink-0 border-t border-wa-line bg-wa-header px-2 py-2.5 pb-[max(env(safe-area-inset-bottom),8px)] md:px-3">
      <p className="mb-2 text-[12px] text-wa-muted">
        A janela de 24 horas fechou. Só um template aprovado alcança o cliente agora.
      </p>

      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold text-wa-text">Template</span>
          <SelectNative
            value={name}
            disabled={disabled || templates.length === 0}
            onChange={(event) => {
              setName(event.target.value);
              setVariables([]);
            }}
            className="border-wa-line bg-wa-panel text-wa-text"
          >
            <option value="">
              {templates.length === 0 ? 'Nenhum template aprovado' : 'Escolha um template'}
            </option>
            {templates.map((template) => (
              <option key={`${template.name}-${template.language}`} value={template.name}>
                {template.name} ({template.language})
              </option>
            ))}
          </SelectNative>
        </label>

        {chosen && chosen.variables > 0
          ? Array.from({ length: chosen.variables }, (_, index) => (
              <label key={index} className="flex flex-col gap-1">
                <span className="text-[12px] font-semibold text-wa-text">Variável {index + 1}</span>
                <input
                  value={variables[index] ?? ''}
                  onChange={(event) => {
                    const next = [...variables];

                    next[index] = event.target.value;
                    setVariables(next);
                  }}
                  className="h-11 w-full rounded-xl border border-wa-line bg-wa-panel px-3 text-wa-text outline-none placeholder:text-wa-muted md:h-10"
                />
              </label>
            ))
          : null}

        <button
          type="button"
          onClick={() => {
            void send();
          }}
          disabled={disabled || sending || !chosen}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-wa-accent px-4 font-semibold text-wa-panel disabled:opacity-45 md:h-10"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          Enviar template
        </button>
      </div>
    </div>
  );
}
