import type { TaskChip } from './ai-events';

export interface AiMessage {
  role: 'user' | 'assistant';
  text: string;
  /** Tarefas citadas pela IA naquela resposta. */
  tasks?: TaskChip[];
}

export interface AiConversation {
  /** Id do servidor; o rascunho que ainda não começou usa 'draft'. */
  id: string;
  title: string;
  updatedAt: string;
  messages: AiMessage[];
}

export const DRAFT_ID = 'draft';

/** Conversas guardadas por workspace e mensagens por conversa. */
const MAX_CONVERSATIONS = 20;
const MAX_MESSAGES = 60;

/** Título da conversa a partir da primeira pergunta. */
export function titleFrom(text: string): string {
  const clean = text.trim().replace(/\s+/g, ' ');

  if (clean === '') {
    return 'Conversa sem título';
  }

  return clean.length > 48 ? `${clean.slice(0, 45)}...` : clean;
}

/** Põe a conversa no topo da lista, substituindo a versão anterior. */
export function upsertConversation(
  list: AiConversation[],
  conversation: AiConversation,
): AiConversation[] {
  const others = list.filter((item) => item.id !== conversation.id && item.id !== DRAFT_ID);
  const trimmed = {
    ...conversation,
    messages: conversation.messages.slice(-MAX_MESSAGES),
  };

  return [trimmed, ...others].slice(0, MAX_CONVERSATIONS);
}

function storageKey(wsId: string): string {
  return `azuos-env:ai:${wsId}`;
}

function isConversation(raw: unknown): raw is AiConversation {
  if (typeof raw !== 'object' || raw === null) {
    return false;
  }

  const record = raw as Record<string, unknown>;

  return (
    typeof record.id === 'string' &&
    typeof record.title === 'string' &&
    typeof record.updatedAt === 'string' &&
    Array.isArray(record.messages)
  );
}

/**
 * O contrato não lista as conversas da IA, então o histórico da tela fica no
 * navegador: abrir uma conversa antiga mostra o que foi dito aqui e segue
 * pelo mesmo conversationId no servidor.
 */
export function loadConversations(wsId: string): AiConversation[] {
  try {
    const raw = window.localStorage.getItem(storageKey(wsId));

    if (raw === null) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed.filter(isConversation) : [];
  } catch {
    return [];
  }
}

export function saveConversations(wsId: string, list: AiConversation[]): void {
  try {
    window.localStorage.setItem(storageKey(wsId), JSON.stringify(list));
  } catch {
    // Navegador sem armazenamento: o histórico vale só para esta sessão.
  }
}
