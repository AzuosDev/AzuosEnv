import { WaInstanceState, WaMessageStatus, WaMessageType } from './whatsapp-fields';
import { isIgnorableJid, waIdFromJid } from './whatsapp-jid';
import { WaInboundContact, WaInboundMessage, WaInboundStatus } from './whatsapp-payload';

/**
 * One delivery of the Evolution webhook, flattened into the same shapes the
 * Cloud API payload already produces. Everything here is pure.
 */
export interface WaEvolutionDelivery {
  /** Dot-cased name of the event, as Evolution sends it. */
  event: string;
  instanceName: string;
  contacts: WaInboundContact[];
  messages: WaInboundMessage[];
  statuses: WaInboundStatus[];
  /** State of the instance, on a connection.update. */
  state: WaInstanceState | null;
  /** QR Code in base64, on a qrcode.updated. */
  qrCode: string | null;
  /** Why nothing came out of the delivery, when nothing did. */
  ignored: string | null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** `data` is one object on most events and an array on some of them. */
function asObjects(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.map(asObject).filter((one): one is Record<string, unknown> => one !== null);
  }

  const one = asObject(value);

  return one ? [one] : [];
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asBoolean(value: unknown): boolean {
  return value === true || value === 'true';
}

/** Baileys sends the timestamp in seconds, as a number or as a string. */
function asDate(value: unknown): Date {
  const seconds = Number(asString(value) || value);

  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : new Date();
}

/** Base64 of the file, wherever this version of Evolution put it. */
function readBase64(raw: Record<string, unknown>, message: Record<string, unknown>): string | null {
  const found = asString(message.base64) || asString(raw.base64) || asString(raw.mediaBase64);

  // `webhook_base64` delivers the raw payload, but a data URI also shows up.
  return found.length > 0 ? found.replace(/^data:[^;]+;base64,/, '') : null;
}

/** Everything one delivery carries. */
export function readEvolutionDelivery(body: Record<string, unknown>): WaEvolutionDelivery {
  const event = asString(body.event).toLowerCase().replace(/_/g, '.');
  const instanceName = asString(body.instance) || asString(asObject(body.data)?.instance);
  const empty: WaEvolutionDelivery = {
    event,
    instanceName,
    contacts: [],
    messages: [],
    statuses: [],
    state: null,
    qrCode: null,
    ignored: null,
  };

  if (event === 'messages.upsert' || event === 'send.message') {
    const inbound = asObjects(body.data)
      .map(readMessage)
      .filter((one): one is WaInboundMessage => one !== null);

    return {
      ...empty,
      contacts: contactsOf(asObjects(body.data)),
      messages: inbound,
      ignored: inbound.length === 0 ? 'no-inbound-message' : null,
    };
  }

  if (event === 'messages.update') {
    const statuses = asObjects(body.data)
      .map(readStatus)
      .filter((one): one is WaInboundStatus => one !== null);

    return { ...empty, statuses, ignored: statuses.length === 0 ? 'no-status' : null };
  }

  if (event === 'connection.update') {
    const state = readState(asObjects(body.data)[0] ?? {});

    return { ...empty, state, ignored: state === null ? 'unknown-state' : null };
  }

  if (event === 'qrcode.updated') {
    const qrCode = readQrCode(asObjects(body.data)[0] ?? {});

    return { ...empty, qrCode, ignored: qrCode === null ? 'no-qrcode' : null };
  }

  return { ...empty, ignored: `event-not-handled:${event || 'missing'}` };
}

function contactsOf(entries: Record<string, unknown>[]): WaInboundContact[] {
  const contacts = new Map<string, string>();

  for (const entry of entries) {
    const jid = asString(asObject(entry.key)?.remoteJid);

    if (isIgnorableJid(jid) || asBoolean(asObject(entry.key)?.fromMe)) {
      continue;
    }

    const waId = waIdFromJid(jid);

    if (waId.length > 0) {
      contacts.set(waId, asString(entry.pushName));
    }
  }

  return [...contacts].map(([waId, profileName]) => ({ waId, profileName }));
}

function readMessage(raw: Record<string, unknown>): WaInboundMessage | null {
  const key = asObject(raw.key) ?? {};
  const jid = asString(key.remoteJid);
  const waMessageId = asString(key.id);

  // Our own messages come back as an echo, groups and the status feed are not
  // attendance, and a delivery with no id could never be made idempotent.
  if (waMessageId.length === 0 || asBoolean(key.fromMe) || isIgnorableJid(jid)) {
    return null;
  }

  const from = waIdFromJid(jid);

  if (from.length === 0) {
    return null;
  }

  const message = asObject(raw.message) ?? {};

  return {
    waMessageId,
    from,
    sentAt: asDate(raw.messageTimestamp),
    replyTo: quotedIdOf(message),
    mediaBase64: readBase64(raw, message),
    ...contentOf(message),
  };
}

/** waMessageId of the quoted message, wherever the context sits. */
function quotedIdOf(message: Record<string, unknown>): string | null {
  for (const value of Object.values(message)) {
    const stanzaId = asString(asObject(asObject(value)?.contextInfo)?.stanzaId);

    if (stanzaId.length > 0) {
      return stanzaId;
    }
  }

  return null;
}

type WaContent = Pick<
  WaInboundMessage,
  'type' | 'body' | 'mediaId' | 'mime' | 'caption' | 'filename' | 'payload'
>;

const EMPTY: Omit<WaContent, 'type' | 'body'> = {
  mediaId: null,
  mime: null,
  caption: '',
  filename: '',
  payload: null,
};

/** Media of Baileys, by the key that carries it. */
const MEDIA_KEYS: Record<string, WaMessageType> = {
  imageMessage: 'image',
  videoMessage: 'video',
  audioMessage: 'audio',
  documentMessage: 'document',
  stickerMessage: 'sticker',
};

/** Per-type part of the message: body, media and the structured extras. */
function contentOf(message: Record<string, unknown>): WaContent {
  const text =
    asString(message.conversation) ||
    asString(asObject(message.extendedTextMessage)?.text) ||
    asString(asObject(message.ephemeralMessage)?.message);

  if (text.length > 0) {
    return { ...EMPTY, type: 'text', body: text };
  }

  const document =
    asObject(message.documentMessage) ??
    asObject(asObject(message.documentWithCaptionMessage)?.message);

  if (document) {
    const caption = asString(document.caption);
    const filename = asString(document.fileName);

    return {
      type: 'document',
      body: caption || filename,
      // The id of the message is what fetches the file back from Evolution.
      mediaId: asString(document.fileSha256) || 'inline',
      mime: asString(document.mimetype) || null,
      caption,
      filename,
      payload: null,
    };
  }

  for (const [key, type] of Object.entries(MEDIA_KEYS)) {
    const media = asObject(message[key]);

    if (!media) {
      continue;
    }

    const caption = asString(media.caption);

    return {
      ...EMPTY,
      type,
      body: caption,
      mediaId: 'inline',
      mime: asString(media.mimetype) || null,
      caption,
    };
  }

  const location = asObject(message.locationMessage);

  if (location) {
    const name = asString(location.name);
    const address = asString(location.address);

    return {
      ...EMPTY,
      type: 'location',
      body: name || address,
      payload: {
        latitude: Number(location.degreesLatitude ?? 0),
        longitude: Number(location.degreesLongitude ?? 0),
        name,
        address,
      },
    };
  }

  const contacts = asObject(message.contactsArrayMessage);
  const contact = asObject(message.contactMessage);

  if (contacts || contact) {
    const names = contacts
      ? (Array.isArray(contacts.contacts) ? contacts.contacts : [])
          .map((one) => asString(asObject(one)?.displayName))
          .filter((name) => name.length > 0)
      : [asString(contact?.displayName)].filter((name) => name.length > 0);

    return {
      ...EMPTY,
      type: 'contacts',
      body: names.join(', '),
      payload: { contacts: names.map((name) => ({ name, phones: [] })) },
    };
  }

  const buttons = asObject(message.buttonsResponseMessage);

  if (buttons) {
    const title = asString(buttons.selectedDisplayText);

    return {
      ...EMPTY,
      type: 'interactive',
      body: title,
      payload: { kind: 'button_reply', id: asString(buttons.selectedButtonId), title },
    };
  }

  const list = asObject(message.listResponseMessage);

  if (list) {
    const title = asString(list.title);

    return {
      ...EMPTY,
      type: 'interactive',
      body: title,
      payload: {
        kind: 'list_reply',
        id: asString(asObject(list.singleSelectReply)?.selectedRowId),
        title,
        description: asString(list.description),
      },
    };
  }

  const reaction = asObject(message.reactionMessage);

  if (reaction) {
    return {
      ...EMPTY,
      type: 'reaction',
      body: asString(reaction.text),
      payload: {
        emoji: asString(reaction.text),
        messageId: asString(asObject(reaction.key)?.id),
      },
    };
  }

  return { ...EMPTY, type: 'unsupported', body: '', payload: { keys: Object.keys(message) } };
}

/** Acknowledgement of Baileys, in the words of this module. */
const STATUS_BY_ACK: Record<string, WaMessageStatus> = {
  PENDING: 'pending',
  SERVER_ACK: 'sent',
  DELIVERY_ACK: 'delivered',
  READ: 'read',
  PLAYED: 'read',
  ERROR: 'failed',
};

function readStatus(raw: Record<string, unknown>): WaInboundStatus | null {
  const key = asObject(raw.key) ?? {};
  const waMessageId = asString(raw.keyId) || asString(key.id);
  const status = STATUS_BY_ACK[asString(raw.status).toUpperCase()];

  if (waMessageId.length === 0 || !status) {
    return null;
  }

  return {
    waMessageId,
    status,
    at: new Date(),
    error:
      status === 'failed'
        ? {
            code: 'EVOLUTION_ERROR',
            title: 'Falha no envio',
            message: 'O WhatsApp recusou a mensagem.',
          }
        : null,
  };
}

function readState(data: Record<string, unknown>): WaInstanceState | null {
  const state = asString(data.state) || asString(data.connection);

  return state === 'open' || state === 'connecting' || state === 'close' ? state : null;
}

function readQrCode(data: Record<string, unknown>): string | null {
  const base64 =
    asString(asObject(data.qrcode)?.base64) || asString(data.base64) || asString(data.qrcode);

  return base64.length > 0 ? base64 : null;
}
