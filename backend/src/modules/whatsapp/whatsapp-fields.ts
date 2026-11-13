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
