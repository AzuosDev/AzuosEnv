import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/api/errors';
import { citedTasks, parseSse, type TaskChip } from '../ai-events';
import { openChatStream } from '../api';
import {
  DRAFT_ID,
  loadConversations,
  saveConversations,
  titleFrom,
  upsertConversation,
  type AiConversation,
} from '../conversations';

function emptyConversation(id: string): AiConversation {
  return { id, title: '', updatedAt: new Date().toISOString(), messages: [] };
}

export interface AiChat {
  conversation: AiConversation;
  conversations: AiConversation[];
  streaming: boolean;
  error: string | null;
  send: (text: string) => void;
  startNew: () => void;
  openConversation: (id: string) => void;
  stop: () => void;
}

/**
 * Conversa com a IA em streaming. A resposta chega em pedaços pelo SSE e o
 * histórico fica no navegador (o contrato não lista conversas), seguindo
 * sempre pelo conversationId que o servidor devolve.
 */
export function useAiChat(wsId: string): AiChat {
  const [conversations, setConversations] = useState<AiConversation[]>(() =>
    loadConversations(wsId),
  );
  const [currentId, setCurrentId] = useState(DRAFT_ID);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeId = useRef(DRAFT_ID);
  const busy = useRef(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    setConversations(loadConversations(wsId));
    setCurrentId(DRAFT_ID);
    activeId.current = DRAFT_ID;
  }, [wsId]);

  useEffect(
    () => () => {
      abort.current?.abort();
    },
    [],
  );

  const persist = useCallback(
    (list: AiConversation[]) => {
      saveConversations(
        wsId,
        list.filter((item) => item.id !== DRAFT_ID),
      );
    },
    [wsId],
  );

  const patchActive = useCallback((update: (conversation: AiConversation) => AiConversation) => {
    setConversations((previous) => {
      const found =
        previous.find((item) => item.id === activeId.current) ??
        emptyConversation(activeId.current);

      return upsertConversation(previous, update(found));
    });
  }, []);

  const writeAnswer = useCallback(
    (text: string, tasks: TaskChip[]) => {
      patchActive((conversation) => {
        const messages = [...conversation.messages];
        const last = messages.length - 1;

        if (messages[last]?.role === 'assistant') {
          messages[last] = { role: 'assistant', text, ...(tasks.length > 0 ? { tasks } : {}) };
        }

        return { ...conversation, updatedAt: new Date().toISOString(), messages };
      });
    },
    [patchActive],
  );

  const adopt = useCallback((conversationId: string) => {
    if (activeId.current === conversationId) {
      return;
    }

    const previousId = activeId.current;

    activeId.current = conversationId;
    setCurrentId(conversationId);
    setConversations((previous) => {
      const found = previous.find((item) => item.id === previousId);

      if (!found) {
        return previous;
      }

      return upsertConversation(
        previous.filter((item) => item.id !== previousId),
        { ...found, id: conversationId },
      );
    });
  }, []);

  const run = useCallback(
    async (message: string, controller: AbortController): Promise<void> => {
      const conversationId = activeId.current === DRAFT_ID ? undefined : activeId.current;
      const results: Record<string, unknown>[] = [];
      let answer = '';

      try {
        const reader = await openChatStream(
          wsId,
          { message, ...(conversationId === undefined ? {} : { conversationId }) },
          controller.signal,
        );
        const decoder = new TextDecoder();
        let buffer = '';

        for (;;) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          const parsed = parseSse(buffer);

          buffer = parsed.rest;

          for (const event of parsed.events) {
            if (event.type === 'start') {
              adopt(event.conversationId);
              continue;
            }

            if (event.type === 'delta') {
              answer += event.text;
              writeAnswer(answer, citedTasks(results));
              continue;
            }

            if (event.type === 'tool') {
              results.push(event.result);
              writeAnswer(answer, citedTasks(results));
              continue;
            }

            if (event.type === 'error') {
              setError(event.message ?? 'A IA não conseguiu responder.');
            }
          }
        }

        if (answer === '') {
          writeAnswer('Não consegui responder agora. Tente de novo.', []);
        }
      } catch (fault) {
        if (controller.signal.aborted) {
          writeAnswer(answer === '' ? 'Resposta interrompida.' : answer, citedTasks(results));

          return;
        }

        setError(errorMessage(fault, 'A IA não respondeu. Tente de novo.'));
        patchActive((conversation) => ({
          ...conversation,
          messages: conversation.messages.filter(
            (item, index) =>
              !(
                item.role === 'assistant' &&
                item.text === '' &&
                index === conversation.messages.length - 1
              ),
          ),
        }));
      }
    },
    [adopt, patchActive, wsId, writeAnswer],
  );

  const send = useCallback(
    (raw: string) => {
      const message = raw.trim();

      if (message === '' || busy.current) {
        return;
      }

      setError(null);
      patchActive((conversation) => ({
        ...conversation,
        title: conversation.title === '' ? titleFrom(message) : conversation.title,
        updatedAt: new Date().toISOString(),
        messages: [
          ...conversation.messages,
          { role: 'user' as const, text: message },
          { role: 'assistant' as const, text: '' },
        ],
      }));

      const controller = new AbortController();

      abort.current = controller;
      busy.current = true;
      setStreaming(true);

      void run(message, controller).finally(() => {
        busy.current = false;
        setStreaming(false);
        setConversations((previous) => {
          persist(previous);

          return previous;
        });
      });
    },
    [patchActive, persist, run],
  );

  const startNew = useCallback(() => {
    abort.current?.abort();
    activeId.current = DRAFT_ID;
    setCurrentId(DRAFT_ID);
    setError(null);
    setConversations((previous) => previous.filter((item) => item.id !== DRAFT_ID));
  }, []);

  const openConversation = useCallback((id: string) => {
    abort.current?.abort();
    activeId.current = id;
    setCurrentId(id);
    setError(null);
  }, []);

  const stop = useCallback(() => {
    abort.current?.abort();
  }, []);

  const conversation =
    conversations.find((item) => item.id === currentId) ?? emptyConversation(currentId);

  return {
    conversation,
    conversations,
    streaming,
    error,
    send,
    startNew,
    openConversation,
    stop,
  };
}
