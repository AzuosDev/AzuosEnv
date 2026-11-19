import type {
  WaAccessLevel,
  WaConversationFilter,
  WaConversationItem,
  WaMessage,
  WaMessageStatus,
} from '@/api/types';

/** Níveis em ordem crescente; o do cargo (owner/admin) já chega como gestor. */
export const WA_LEVELS = ['atendente', 'supervisor', 'gestor'] as const;

export const WA_LEVEL_LABEL: Record<WaAccessLevel, string> = {
  atendente: 'Atendente',
  supervisor: 'Supervisor',
  gestor: 'Gestor',
};

export function hasWaLevel(level: WaAccessLevel | null, needed: WaAccessLevel): boolean {
  if (!level) {
    return false;
  }

  return WA_LEVELS.indexOf(level) >= WA_LEVELS.indexOf(needed);
}

/** Abas da Central. `ready` separa o que é desta etapa do que entra na F20. */
export const WA_TABS = [
  { id: 'visao-geral', label: 'Visão geral', level: 'supervisor', ready: false },
  { id: 'conversas', label: 'Conversas', level: 'atendente', ready: true },
  { id: 'contatos', label: 'Contatos', level: 'atendente', ready: true },
  { id: 'regras', label: 'Regras do bot', level: 'gestor', ready: false },
  { id: 'bot', label: 'Bot e mensagens', level: 'gestor', ready: false },
  { id: 'respostas', label: 'Respostas rápidas', level: 'gestor', ready: false },
  { id: 'horarios', label: 'Horários', level: 'gestor', ready: false },
  { id: 'conexao', label: 'Conexão', level: 'gestor', ready: true },
  { id: 'equipe', label: 'Equipe', level: 'gestor', ready: true },
] as const satisfies readonly {
  id: string;
  label: string;
  level: WaAccessLevel;
  ready: boolean;
}[];

export type WaTabId = (typeof WA_TABS)[number]['id'];
export type WaTab = (typeof WA_TABS)[number];

export const DEFAULT_WA_TAB: WaTabId = 'conversas';

/** Abas que o nível alcança; sem nível a Central não aparece. */
export function visibleWaTabs(level: WaAccessLevel | null): WaTab[] {
  if (!level) {
    return [];
  }

  return WA_TABS.filter((tab) => hasWaLevel(level, tab.level));
}

/**
 * Aba pedida quando o nível a alcança. Sem ela a Central abre em Conversas, que
 * é o trabalho do dia; só quem não alcança Conversas cai na primeira liberada.
 */
export function resolveWaTab(tab: string | undefined, level: WaAccessLevel | null): WaTabId {
  const allowed = visibleWaTabs(level);
  const found = allowed.find((item) => item.id === tab);

  if (found) {
    return found.id;
  }

  const fallback = allowed.find((item) => item.id === DEFAULT_WA_TAB);

  return fallback?.id ?? allowed[0]?.id ?? DEFAULT_WA_TAB;
}

/* Filtros da lista -------------------------------------------------------- */

export const WA_FILTERS = [
  { id: 'open', label: 'Abertas' },
  { id: 'unread', label: 'Não lidas' },
  { id: 'waiting', label: 'Aguardando' },
  { id: 'mine', label: 'Minhas' },
  { id: 'priority', label: 'Prioridade' },
  { id: 'closed', label: 'Finalizadas' },
  { id: 'all', label: 'Todas' },
] as const satisfies readonly { id: WaConversationFilter; label: string }[];

export function resolveWaFilter(filter: string | undefined): WaConversationFilter {
  const found = WA_FILTERS.find((item) => item.id === filter);

  return found?.id ?? 'open';
}

/* Contato ----------------------------------------------------------------- */

/** Nome que a equipe deu, o do perfil do WhatsApp ou o próprio número. */
export function contactLabel(item: WaConversationItem): string {
  const contact = item.contact;

  if (!contact) {
    return 'Contato';
  }

  return contact.name || contact.profileName || formatWaNumber(contact.waId);
}

/**
 * Número no formato que o Brasil lê. Fora do +55 o número sai agrupado em
 * blocos de quatro, que é o melhor palpite sem uma base de DDI.
 */
export function formatWaNumber(waId: string): string {
  const digits = waId.replace(/\D/g, '');

  if (digits.length === 0) {
    return '';
  }

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    const area = digits.slice(2, 4);
    const rest = digits.slice(4);
    const head = rest.slice(0, rest.length - 4);

    return `+55 ${area} ${head}-${rest.slice(-4)}`;
  }

  return `+${digits.slice(0, digits.length - 4).replace(/(\d{1,4})(?=(\d{4})+$)/g, '$1 ')}${
    digits.length > 4 ? ' ' : ''
  }${digits.slice(-4)}`.trim();
}

export function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => /\p{L}/u.test(part));

  if (parts.length === 0) {
    return '#';
  }

  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';

  return (first + last).toUpperCase();
}

/* Mensagem ---------------------------------------------------------------- */

export const WA_TYPE_LABEL: Record<WaMessage['type'], string> = {
  text: 'Mensagem',
  image: 'Imagem',
  audio: 'Áudio',
  video: 'Vídeo',
  document: 'Documento',
  sticker: 'Figurinha',
  location: 'Localização',
  contacts: 'Contato',
  interactive: 'Menu',
  reaction: 'Reação',
  template: 'Template',
  unsupported: 'Mensagem não suportada',
};

/** Prévia da conversa na lista: o texto, ou o tipo quando não há texto. */
export function previewOf(message: WaMessage | null): string {
  if (!message) {
    return 'Nenhuma mensagem ainda';
  }

  if (message.type === 'reaction') {
    return `Reagiu ${message.body}`.trim();
  }

  if (message.type === 'text' || message.type === 'template') {
    return message.body || WA_TYPE_LABEL[message.type];
  }

  const caption = message.media?.caption ?? message.body;

  return caption ? `${WA_TYPE_LABEL[message.type]}: ${caption}` : WA_TYPE_LABEL[message.type];
}

/** Reações chegam como mensagem própria e aparecem na bolha que citam. */
export function isReaction(message: WaMessage): boolean {
  return message.type === 'reaction';
}

export function reactionsOf(messages: WaMessage[]): Map<string, string[]> {
  const byMessage = new Map<string, string[]>();

  for (const message of messages) {
    if (!isReaction(message) || !message.replyTo || message.body === '') {
      continue;
    }

    const current = byMessage.get(message.replyTo) ?? [];

    byMessage.set(message.replyTo, [...current, message.body]);
  }

  return byMessage;
}

/** Mensagens visíveis na conversa: a reação vira selo da bolha citada. */
export function visibleMessages(messages: WaMessage[]): WaMessage[] {
  return messages.filter((message) => !isReaction(message));
}

export type WaCheck = 'none' | 'sent' | 'delivered' | 'read' | 'failed';

/** ✓ enviado, ✓✓ entregue, ✓✓ azul lido; a falha vira aviso na bolha. */
export function checkOf(message: WaMessage): WaCheck {
  if (message.direction === 'inbound') {
    return 'none';
  }

  const map: Record<WaMessageStatus, WaCheck> = {
    pending: 'none',
    sent: 'sent',
    delivered: 'delivered',
    read: 'read',
    failed: 'failed',
  };

  return map[message.status];
}

/* Janela de 24 h e pausa do bot ------------------------------------------- */

export const WA_WINDOW_HOURS = 24;

/**
 * Fora da janela de 24 h desde a última mensagem do contato, a Meta só aceita
 * template: o campo de texto dá lugar à escolha do template.
 */
export function windowOpen(lastInboundAt: string | null, now: Date = new Date()): boolean {
  if (!lastInboundAt) {
    return false;
  }

  const at = new Date(lastInboundAt).getTime();

  if (Number.isNaN(at)) {
    return false;
  }

  return now.getTime() - at < WA_WINDOW_HOURS * 60 * 60 * 1000;
}

/** Data da pausa do bot só quando ela ainda está no futuro. */
export function botPauseUntil(botPausedUntil: string | null, now: Date = new Date()): Date | null {
  if (!botPausedUntil) {
    return null;
  }

  const at = new Date(botPausedUntil);

  if (Number.isNaN(at.getTime()) || at.getTime() <= now.getTime()) {
    return null;
  }

  return at;
}

/* Agrupamento por dia ----------------------------------------------------- */

export interface WaMessageDay {
  /** yyyy-MM-dd no fuso do navegador; é a chave do separador. */
  day: string;
  items: WaMessage[];
}

export function dayKeyOf(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${String(date.getFullYear())}-${month}-${day}`;
}

/** Mensagens em ordem crescente, quebradas por dia para o separador. */
export function groupWaMessagesByDay(messages: WaMessage[]): WaMessageDay[] {
  const days: WaMessageDay[] = [];

  for (const message of messages) {
    const day = dayKeyOf(message.sentAt);
    const last = days[days.length - 1];

    if (last && last.day === day) {
      last.items.push(message);

      continue;
    }

    days.push({ day, items: [message] });
  }

  return days;
}

interface Page<T> {
  items: T[];
}

/**
 * Mensagens das páginas carregadas em ordem crescente de tempo: a API devolve
 * da mais nova para a mais antiga e cada página seguinte é mais antiga ainda.
 */
export function mergeWaMessagePages(pages: Page<WaMessage>[] | undefined): WaMessage[] {
  return (pages ?? [])
    .flatMap((page) => page.items)
    .slice()
    .reverse();
}

export function mergeWaPages<T>(pages: Page<T>[] | undefined): T[] {
  return (pages ?? []).flatMap((page) => page.items);
}

/* Atalho das respostas rápidas ------------------------------------------- */

/**
 * Quando o campo está no comando de resposta rápida, devolve o que foi digitado
 * depois da "/". Só vale com a "/" abrindo a mensagem, nunca no meio do texto.
 */
export function quickReplyTerm(text: string): string | null {
  if (!text.startsWith('/')) {
    return null;
  }

  const term = text.slice(1);

  return /\s/.test(term) ? null : term;
}
