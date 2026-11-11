import { Send, Sparkles, Square } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AiChat } from '../hooks/use-ai-chat';
import { AiMarkdown } from './ai-markdown';
import { TaskChips } from './task-chips';

/** Perguntas prontas da tela vazia. */
export const SUGGESTIONS = [
  'O que está atrasado?',
  'Minhas tarefas de hoje',
  'Resumo da semana',
  'O que vence até sexta?',
];

export interface AiChatViewProps {
  wsId: string;
  chat: AiChat;
  /** Gaveta da topbar: menos respiro e sem as perguntas prontas em linha. */
  compact?: boolean;
}

/** Conversa com a IA: mensagens, sugestões iniciais e o campo de pergunta. */
export function AiChatView({ wsId, chat, compact = false }: AiChatViewProps) {
  const [draft, setDraft] = useState('');
  const promptId = useId();
  const bottom = useRef<HTMLDivElement | null>(null);
  const { conversation, streaming, error } = chat;
  const empty = conversation.messages.length === 0;

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [conversation.messages]);

  const submit = (text: string): void => {
    chat.send(text);
    setDraft('');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <section
        aria-label="Conversa com a IA"
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto',
          compact ? 'px-1 py-2' : 'mx-auto w-full max-w-[860px] px-4 py-4 md:px-6',
        )}
      >
        {empty ? (
          <div className="stage relative overflow-hidden rounded-2xl border border-scene-line px-5 py-8 text-center md:px-7 md:py-12">
            <div className="dot-grid absolute inset-0 opacity-60" aria-hidden="true" />
            <div className="relative flex flex-col items-center gap-2.5">
              <h2 className="heading text-[20px] md:text-[26px]">
                Como posso ajudar no trabalho de hoje?
              </h2>
              <p className="max-w-[460px] text-body">
                Pergunte sobre tarefas, prazos e clientes, ou cole um texto para virar tarefas.
              </p>
            </div>
          </div>
        ) : null}

        {conversation.messages.map((message, index) => (
          <div
            key={`${String(index)}-${message.role}`}
            className={cn('flex gap-3', message.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            {message.role === 'assistant' ? (
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-scene text-accent"
                aria-hidden="true"
              >
                <Sparkles className="h-4 w-4" />
              </span>
            ) : null}

            <div className="flex min-w-0 max-w-[640px] flex-col gap-2.5">
              <div
                className={cn(
                  'rounded-[14px] px-3.5 py-3',
                  message.role === 'user'
                    ? 'bg-surface-2 text-ink'
                    : 'border border-line bg-surface text-body',
                )}
              >
                {message.role === 'assistant' ? (
                  message.text === '' ? (
                    <span className="text-muted">Escrevendo…</span>
                  ) : (
                    <AiMarkdown text={message.text} />
                  )
                ) : (
                  <p className="whitespace-pre-line">{message.text}</p>
                )}
              </div>

              {message.tasks && message.tasks.length > 0 ? (
                <TaskChips wsId={wsId} tasks={message.tasks} />
              ) : null}
            </div>
          </div>
        ))}

        <div ref={bottom} />
      </section>

      {error !== null ? (
        <p role="alert" className="border-t border-line px-4 py-2 text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      <div
        className={cn(
          'flex shrink-0 flex-col gap-2.5 border-t border-line pt-3',
          compact ? 'px-1 pb-2' : 'mx-auto w-full max-w-[860px] px-4 pb-4 md:px-6',
        )}
      >
        {empty ? (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="h-9 rounded-full border border-line px-3 text-[13px] text-body hover:bg-surface-2 hover:text-ink"
                onClick={() => {
                  submit(suggestion);
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        <form
          className="flex items-end gap-2 rounded-[14px] border border-line bg-surface p-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit(draft);
          }}
        >
          <label htmlFor={promptId} className="sr-only">
            Pergunte à IA
          </label>
          <textarea
            id={promptId}
            rows={2}
            value={draft}
            placeholder="Pergunte algo sobre o workspace…"
            className="min-h-[44px] flex-1 resize-none bg-transparent px-2 py-1.5 text-ink outline-none placeholder:text-muted"
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit(draft);
              }
            }}
          />

          {streaming ? (
            <Button type="button" variant="ghost" size="sm" onClick={chat.stop}>
              <Square className="h-4 w-4" aria-hidden="true" /> Parar
            </Button>
          ) : (
            <Button type="submit" size="sm" disabled={draft.trim() === ''}>
              <Send className="h-4 w-4" aria-hidden="true" /> Enviar
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
