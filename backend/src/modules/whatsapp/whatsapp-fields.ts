/** Levels of the whatsapp module permission, from the narrowest to the widest. */
export const WA_ACCESS_LEVELS = ['atendente', 'supervisor', 'gestor'] as const;
export type WaAccessLevel = (typeof WA_ACCESS_LEVELS)[number];

const LEVEL_RANK: Record<WaAccessLevel, number> = { atendente: 1, supervisor: 2, gestor: 3 };

export function waLevelRank(level: WaAccessLevel): number {
  return LEVEL_RANK[level];
}

/** True when `level` covers everything `required` allows. */
export function hasWaLevelAtLeast(
  level: WaAccessLevel | null,
  required: WaAccessLevel,
): level is WaAccessLevel {
  return level !== null && LEVEL_RANK[level] >= LEVEL_RANK[required];
}

export const WA_CONNECTION_STATUSES = ['pending', 'connected', 'error'] as const;
export type WaConnectionStatus = (typeof WA_CONNECTION_STATUSES)[number];

export const WA_CONVERSATION_STATUSES = ['open', 'waiting', 'closed'] as const;
export type WaConversationStatus = (typeof WA_CONVERSATION_STATUSES)[number];

export const WA_CONVERSATION_MODES = ['bot', 'human'] as const;
export type WaConversationMode = (typeof WA_CONVERSATION_MODES)[number];

export const WA_PRIORITIES = ['normal', 'high', 'urgent'] as const;
export type WaPriority = (typeof WA_PRIORITIES)[number];

/** Saved views of the conversation list. */
export const WA_CONVERSATION_FILTERS = [
  'open',
  'unread',
  'waiting',
  'mine',
  'priority',
  'closed',
  'all',
] as const;
export type WaConversationFilter = (typeof WA_CONVERSATION_FILTERS)[number];

export const WA_MESSAGE_TYPES = [
  'text',
  'image',
  'audio',
  'video',
  'document',
  'sticker',
  'location',
  'contacts',
  'interactive',
  'reaction',
  'template',
  'unsupported',
] as const;
export type WaMessageType = (typeof WA_MESSAGE_TYPES)[number];

/** Types whose content is a file downloaded from the Graph API. */
export const WA_MEDIA_TYPES = ['image', 'audio', 'video', 'document', 'sticker'] as const;
export type WaMediaType = (typeof WA_MEDIA_TYPES)[number];

export function isWaMediaType(type: WaMessageType): type is WaMediaType {
  return (WA_MEDIA_TYPES as readonly string[]).includes(type);
}

export const WA_DIRECTIONS = ['inbound', 'outbound'] as const;
export type WaDirection = (typeof WA_DIRECTIONS)[number];

export const WA_MESSAGE_STATUSES = ['pending', 'sent', 'delivered', 'read', 'failed'] as const;
export type WaMessageStatus = (typeof WA_MESSAGE_STATUSES)[number];

const STATUS_RANK: Record<WaMessageStatus, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4,
};

/** Meta may deliver the callbacks out of order; the status never walks back. */
export function isStatusAhead(current: WaMessageStatus, next: WaMessageStatus): boolean {
  return STATUS_RANK[next] > STATUS_RANK[current];
}

/** Free text only answers an inbound message of the last 24 hours. */
export const WA_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isWindowOpen(lastInboundAt: Date | null, now: Date = new Date()): boolean {
  return lastInboundAt !== null && now.getTime() - lastInboundAt.getTime() < WA_WINDOW_MS;
}

/** Header Meta signs the raw body with, using the App Secret. */
export const WA_SIGNATURE_HEADER = 'x-hub-signature-256';

export const GRAPH_TIMEOUT_MS = 15_000;

/** Ceiling of documents a listing loads before filtering in memory. */
export const MAX_WA_SCAN = 500;

/** Space and List the lead of a conversation lands in. */
export const LEAD_SPACE_NAME = 'Comercial';
export const LEAD_LIST_NAME = 'Leads';

/** Kinds of menu the bot offers; the Cloud API caps buttons at 3 and rows at 10. */
export const WA_MENU_KINDS = ['buttons', 'list'] as const;
export type WaMenuKind = (typeof WA_MENU_KINDS)[number];

export const MAX_WA_BUTTONS = 3;
export const MAX_WA_LIST_ROWS = 10;

/** What makes a bot rule fire. */
export const WA_BOT_TRIGGERS = [
  'firstMessage',
  'keyword',
  'contains',
  'regex',
  'menuOption',
  'outsideHours',
] as const;
export type WaBotTrigger = (typeof WA_BOT_TRIGGERS)[number];

/** Triggers that only make sense at a specific moment, never on a plain match. */
export const WA_CONTEXT_TRIGGERS: readonly WaBotTrigger[] = ['firstMessage', 'outsideHours'];

/** Shape of the answer a rule sends back. */
export const WA_BOT_REPLY_KINDS = ['none', 'text', 'media', 'buttons', 'list'] as const;
export type WaBotReplyKind = (typeof WA_BOT_REPLY_KINDS)[number];

/** Side effects a rule applies to the conversation. */
export const WA_BOT_ACTION_KINDS = [
  'transferToHuman',
  'assign',
  'tag',
  'priority',
  'createLead',
] as const;
export type WaBotActionKind = (typeof WA_BOT_ACTION_KINDS)[number];

/** Minutes the bot stays quiet after an attendant answers. */
export const DEFAULT_WA_BOT_PAUSE_MINUTES = 30;
export const MAX_WA_BOT_PAUSE_MINUTES = 24 * 60;

/** Ceiling of the knowledge base the AI answer is grounded on. */
export const MAX_WA_KNOWLEDGE_CHARS = 20_000;

/** Ceiling of one AI answer, so the bot never writes a wall of text. */
export const DEFAULT_WA_AI_ANSWER_CHARS = 600;
export const MAX_WA_AI_ANSWER_CHARS = 1500;

/** Word the model answers with when the base does not cover the question. */
export const WA_AI_HANDOFF_TOKEN = 'TRANSFERIR';

/** Characters of the contact message handed to the model. */
export const MAX_WA_AI_QUESTION_CHARS = 1000;

/** Text of a message a rule matches against; longer than this is cut. */
export const MAX_WA_MATCH_CHARS = 2000;

/** Shortcut of a quick reply, as typed after the `/` of the message field. */
export const WA_SHORTCUT = /^[a-z0-9][a-z0-9._-]{0,39}$/;

export const MAX_WA_QUICK_REPLY_CHARS = 4096;

/** `HH:mm` of a business-hours range. */
export const WA_TIME_OF_DAY = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** `YYYY-MM-DD` of a holiday. */
export const WA_DATE_KEY = /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

/** Days a period of the overview may cover. */
export const MAX_WA_OVERVIEW_DAYS = 366;
export const DEFAULT_WA_OVERVIEW_DAYS = 30;

/** Conversations one overview reads. */
export const MAX_WA_OVERVIEW_CONVERSATIONS = 5000;
