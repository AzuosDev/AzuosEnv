import type {
  WaAccessLevel,
  WaCapabilities,
  WaConnectionState,
  WaProvider,
  WaBotActionKind,
  WaBotReplyKind,
  WaBotRule,
  WaBotTrigger,
  WaConversationFilter,
  WaConversationItem,
  WaHoursDay,
  WaMenuKind,
  WaMessage,
  WaMessageStatus,
  WaOverview,
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

/* Provedor e conexão ------------------------------------------------------ */

export const WA_PROVIDERS = ['evolution', 'cloud'] as const;

export const WA_PROVIDER_LABEL: Record<WaProvider, string> = {
  evolution: 'Evolution (QR Code)',
  cloud: 'Cloud API oficial (Meta)',
};

export const DEFAULT_WA_PROVIDER: WaProvider = 'evolution';

/**
 * O que o provedor sabe fazer. Espelha o `waCapabilities` do backend, para a
 * tela já se moldar antes de a resposta da conexão chegar.
 */
export function waCapabilities(provider: WaProvider | null | undefined): WaCapabilities {
  return provider === 'cloud'
    ? { templates: true, window: true, qrCode: false }
    : { templates: false, window: false, qrCode: true };
}

export const WA_CONNECTION_LABEL: Record<WaConnectionState, string> = {
  pending: 'pendente',
  connected: 'conectado',
  disconnected: 'desconectado',
  error: 'com erro',
};

/** Selo do cabeçalho da Central, pelo estado real da conexão. */
export function waConnectionLabel(status: WaConnectionState | null | undefined): string {
  return `WhatsApp ${status ? WA_CONNECTION_LABEL[status] : 'sem conexão'}`;
}

/**
 * Se o campo de texto livre alcança o cliente. Na Evolution alcança sempre; na
 * Cloud API só dentro da janela de 24 h desde a última mensagem recebida.
 */
export function canSendFreely(
  provider: WaProvider | null | undefined,
  lastInboundAt: string | null,
  now: Date = new Date(),
): boolean {
  return !waCapabilities(provider).window || windowOpen(lastInboundAt, now);
}

/** Abas da Central. `ready` guarda o que ainda não tem tela (nada, na F20). */
export const WA_TABS = [
  { id: 'visao-geral', label: 'Visão geral', level: 'supervisor', ready: true },
  { id: 'conversas', label: 'Conversas', level: 'atendente', ready: true },
  { id: 'contatos', label: 'Contatos', level: 'atendente', ready: true },
  { id: 'regras', label: 'Regras do bot', level: 'gestor', ready: true },
  { id: 'bot', label: 'Bot e mensagens', level: 'gestor', ready: true },
  { id: 'respostas', label: 'Respostas rápidas', level: 'gestor', ready: true },
  { id: 'horarios', label: 'Horários', level: 'gestor', ready: true },
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

/* Bot: gatilho, resposta e ação ------------------------------------------ */

export const WA_TRIGGERS = [
  'firstMessage',
  'keyword',
  'contains',
  'regex',
  'menuOption',
  'outsideHours',
] as const satisfies readonly WaBotTrigger[];

export const WA_TRIGGER_LABEL: Record<WaBotTrigger, string> = {
  firstMessage: 'Primeira mensagem da conversa',
  keyword: 'Palavra exata',
  contains: 'Contém o trecho',
  regex: 'Expressão regular',
  menuOption: 'Opção do menu',
  outsideHours: 'Fora do horário',
};

/** Gatilhos que casam por um valor digitado; os outros valem pelo momento. */
export const WA_VALUE_TRIGGERS: readonly WaBotTrigger[] = [
  'keyword',
  'contains',
  'regex',
  'menuOption',
];

export function triggerNeedsValue(kind: WaBotTrigger): boolean {
  return WA_VALUE_TRIGGERS.includes(kind);
}

export const WA_REPLY_KINDS = [
  'none',
  'text',
  'media',
  'buttons',
  'list',
] as const satisfies readonly WaBotReplyKind[];

export const WA_REPLY_KIND_LABEL: Record<WaBotReplyKind, string> = {
  none: 'Sem resposta',
  text: 'Texto',
  media: 'Arquivo por link',
  buttons: 'Botões',
  list: 'Lista',
};

export const WA_ACTION_KINDS = [
  'transferToHuman',
  'assign',
  'tag',
  'priority',
  'createLead',
] as const satisfies readonly WaBotActionKind[];

export const WA_ACTION_LABEL: Record<WaBotActionKind, string> = {
  transferToHuman: 'Transferir para um atendente',
  assign: 'Atribuir a alguém',
  tag: 'Aplicar etiqueta',
  priority: 'Mudar a prioridade',
  createLead: 'Criar lead',
};

/** Tetos da Cloud API: três botões ou dez linhas de lista. */
export const MAX_WA_BUTTONS = 3;
export const MAX_WA_LIST_ROWS = 10;

export function maxMenuOptions(kind: WaMenuKind): number {
  return kind === 'list' ? MAX_WA_LIST_ROWS : MAX_WA_BUTTONS;
}

/** Erro que impede salvar a regra, na mesma ordem do backend. Null é válida. */
export function waRuleError(rule: {
  name: string;
  trigger: { kind: WaBotTrigger; value: string };
  reply: { kind: WaBotReplyKind; text: string; mediaUrl: string; options: unknown[] };
}): string | null {
  if (rule.name.trim() === '') {
    return 'A regra precisa de um nome.';
  }

  const value = rule.trigger.value.trim();

  if (triggerNeedsValue(rule.trigger.kind) && value === '') {
    return 'Este gatilho precisa de um valor.';
  }

  if (rule.trigger.kind === 'regex') {
    try {
      new RegExp(value, 'i');
    } catch {
      return 'A expressão regular da regra não é válida.';
    }
  }

  if (rule.reply.kind === 'text' && rule.reply.text.trim() === '') {
    return 'A resposta de texto precisa de conteúdo.';
  }

  if (rule.reply.kind === 'media' && rule.reply.mediaUrl.trim() === '') {
    return 'A resposta de mídia precisa de um link.';
  }

  if (rule.reply.kind === 'buttons' || rule.reply.kind === 'list') {
    if (rule.reply.options.length === 0) {
      return 'A resposta interativa precisa de pelo menos uma opção.';
    }

    const max = maxMenuOptions(rule.reply.kind === 'list' ? 'list' : 'buttons');

    if (rule.reply.options.length > max) {
      return rule.reply.kind === 'list'
        ? `A lista interativa aceita no máximo ${String(MAX_WA_LIST_ROWS)} opções.`
        : `O menu de botões aceita no máximo ${String(MAX_WA_BUTTONS)} opções.`;
    }
  }

  return null;
}

/** Resumo de uma linha da regra, do gatilho para a resposta. */
export function waRuleSummary(rule: WaBotRule): string {
  const trigger = triggerNeedsValue(rule.trigger.kind)
    ? `${WA_TRIGGER_LABEL[rule.trigger.kind]}: "${rule.trigger.value}"`
    : WA_TRIGGER_LABEL[rule.trigger.kind];

  return `${trigger} → ${WA_REPLY_KIND_LABEL[rule.reply.kind]}`;
}

/** Variáveis que o backend resolve no envio; a prévia mostra o mesmo texto. */
export const WA_VARIABLES = ['nome', 'numero'] as const;

export function renderWaPreview(
  text: string,
  values: Record<string, string> = { nome: 'Ana', numero: '(31) 98888-0001' },
): string {
  return text.replace(/\{([a-z]+)\}/gi, (whole, key: string) => values[key.toLowerCase()] ?? whole);
}

/* Horários ---------------------------------------------------------------- */

/** Dias da semana na ordem do WhatsApp: 0 é domingo, como no backend. */
export const WA_WEEKDAYS = [
  { weekday: 0, label: 'Domingo', short: 'Dom' },
  { weekday: 1, label: 'Segunda', short: 'Seg' },
  { weekday: 2, label: 'Terça', short: 'Ter' },
  { weekday: 3, label: 'Quarta', short: 'Qua' },
  { weekday: 4, label: 'Quinta', short: 'Qui' },
  { weekday: 5, label: 'Sexta', short: 'Sex' },
  { weekday: 6, label: 'Sábado', short: 'Sáb' },
] as const;

const TIME_OF_DAY = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export function isTimeOfDay(value: string): boolean {
  return TIME_OF_DAY.test(value.trim());
}

/** Primeira hora que não serve para salvar, ou null quando tudo confere. */
export function hoursError(days: WaHoursDay[]): string | null {
  for (const day of days) {
    for (const range of day.ranges) {
      if (!isTimeOfDay(range.start) || !isTimeOfDay(range.end)) {
        const label = WA_WEEKDAYS.find((one) => one.weekday === day.weekday)?.label ?? '';

        return `Confira as horas de ${label}: use HH:mm entre 00:00 e 23:59.`;
      }
    }
  }

  return null;
}

/** Só os dias com faixa entram no documento; dia sem faixa é dia fechado. */
export function usedHoursDays(days: WaHoursDay[]): WaHoursDay[] {
  return days
    .filter((day) => day.ranges.length > 0)
    .map((day) => ({
      weekday: day.weekday,
      ranges: day.ranges.map((range) => ({ start: range.start.trim(), end: range.end.trim() })),
    }));
}

/* Visão geral ------------------------------------------------------------- */

export const WA_PERIODS = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
] as const;

export type WaPeriodDays = (typeof WA_PERIODS)[number]['days'];

export function resolveWaPeriod(value: string | undefined): WaPeriodDays {
  const found = WA_PERIODS.find((period) => String(period.days) === value);

  return found?.days ?? 30;
}

/** Janela em UTC ISO 8601 que a API espera, do passado para agora. */
export function waPeriodRange(days: number, now: Date = new Date()): { from: string; to: string } {
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  return { from: from.toISOString(), to: now.toISOString() };
}

/** Duração em segundos escrita em pt-BR; null vira travessão. */
export function durationLabel(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return '—';
  }

  const total = Math.round(seconds);

  if (total < 60) {
    return `${String(total)} s`;
  }

  const minutes = Math.round(total / 60);

  if (minutes < 60) {
    return `${String(minutes)} min`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest === 0 ? `${String(hours)} h` : `${String(hours)} h ${String(rest)} min`;
}

/** Altura relativa de cada barra do gráfico de novas por dia. */
export function dayBars(overview: WaOverview | undefined): {
  date: string;
  count: number;
  ratio: number;
}[] {
  const days = overview?.newPerDay ?? [];
  const top = days.reduce((max, day) => Math.max(max, day.count), 0);

  return days.map((day) => ({
    date: day.date,
    count: day.count,
    ratio: top === 0 ? 0 : day.count / top,
  }));
}
