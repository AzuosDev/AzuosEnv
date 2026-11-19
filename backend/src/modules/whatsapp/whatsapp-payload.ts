import { WA_MESSAGE_STATUSES, WaMessageStatus, WaMessageType } from './whatsapp-fields';

/** Message the contact sent us, already flattened out of the webhook envelope. */
export interface WaInboundMessage {
  waMessageId: string;
  /** wa_id of the sender. */
  from: string;
  sentAt: Date;
  type: WaMessageType;
  body: string;
  mediaId: string | null;
  mime: string | null;
  caption: string;
  filename: string;
  /** waMessageId of the quoted message. */
  replyTo: string | null;
  payload: Record<string, unknown> | null;
}

export interface WaInboundStatus {
  waMessageId: string;
  status: WaMessageStatus;
  at: Date;
  error: { code: string; title: string; message: string } | null;
}

export interface WaInboundContact {
  waId: string;
  profileName: string;
}

/** One `changes[].value` of the envelope, with everything we act on. */
export interface WaWebhookChange {
  phoneNumberId: string;
  contacts: WaInboundContact[];
  messages: WaInboundMessage[];
  statuses: WaInboundStatus[];
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asObject).filter((one) => one !== null) : [];
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Meta sends the timestamp in seconds, as a string. */
function asDate(value: unknown): Date {
  const seconds = Number(asString(value));

  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : new Date();
}

function changeValues(body: Record<string, unknown>): Record<string, unknown>[] {
  return asArray(body.entry).flatMap((entry) =>
    asArray(entry.changes)
      .map((change) => asObject(change.value))
      .filter((value) => value !== null),
  );
}

/**
 * Number the payload is about; it is what routes the webhook to a workspace. The
 * first metadata of the envelope wins, since Meta groups one number per delivery.
 */
export function readPhoneNumberId(body: Record<string, unknown>): string | null {
  for (const value of changeValues(body)) {
    const id = asString(asObject(value.metadata)?.phone_number_id);

    if (id.length > 0) {
      return id;
    }
  }

  return null;
}

/** Everything the envelope carries, grouped by `changes[].value`. */
export function readChanges(body: Record<string, unknown>): WaWebhookChange[] {
  const changes: WaWebhookChange[] = [];

  for (const value of changeValues(body)) {
    const phoneNumberId = asString(asObject(value.metadata)?.phone_number_id);

    if (phoneNumberId.length === 0) {
      continue;
    }

    changes.push({
      phoneNumberId,
      contacts: readContacts(value),
      messages: readMessages(value),
      statuses: readStatuses(value),
    });
  }

  return changes;
}

function readContacts(value: Record<string, unknown>): WaInboundContact[] {
  return asArray(value.contacts)
    .map((contact) => ({
      waId: asString(contact.wa_id),
      profileName: asString(asObject(contact.profile)?.name),
    }))
    .filter((contact) => contact.waId.length > 0);
}

function readMessages(value: Record<string, unknown>): WaInboundMessage[] {
  return asArray(value.messages)
    .map(readMessage)
    .filter((message): message is WaInboundMessage => message !== null);
}

function readMessage(raw: Record<string, unknown>): WaInboundMessage | null {
  const waMessageId = asString(raw.id);
  const from = asString(raw.from);

  if (waMessageId.length === 0 || from.length === 0) {
    return null;
  }

  const base = {
    waMessageId,
    from,
    sentAt: asDate(raw.timestamp),
    replyTo: asString(asObject(raw.context)?.id) || null,
    mediaId: null,
    mime: null,
    caption: '',
    filename: '',
    payload: null,
  };

  return { ...base, ...contentOf(raw) };
}

/** Per-type part of the message: body, media and the structured extras. */
function contentOf(
  raw: Record<string, unknown>,
): Pick<
  WaInboundMessage,
  'type' | 'body' | 'mediaId' | 'mime' | 'caption' | 'filename' | 'payload'
> {
  const type = asString(raw.type);
  const empty = { mediaId: null, mime: null, caption: '', filename: '', payload: null };

  if (type === 'text') {
    return { ...empty, type: 'text', body: asString(asObject(raw.text)?.body) };
  }

  if (type === 'image' || type === 'audio' || type === 'video' || type === 'sticker') {
    const media = asObject(raw[type]) ?? {};
    const caption = asString(media.caption);

    return {
      ...empty,
      type,
      body: caption,
      mediaId: asString(media.id) || null,
      mime: asString(media.mime_type) || null,
      caption,
    };
  }

  if (type === 'document') {
    const media = asObject(raw.document) ?? {};
    const caption = asString(media.caption);

    return {
      type: 'document',
      body: caption || asString(media.filename),
      mediaId: asString(media.id) || null,
      mime: asString(media.mime_type) || null,
      caption,
      filename: asString(media.filename),
      payload: null,
    };
  }

  if (type === 'location') {
    const location = asObject(raw.location) ?? {};

    return {
      ...empty,
      type: 'location',
      body: asString(location.name) || asString(location.address),
      payload: {
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        name: asString(location.name),
        address: asString(location.address),
      },
    };
  }

  if (type === 'contacts') {
    const contacts = asArray(raw.contacts).map((contact) => ({
      name: asString(asObject(contact.name)?.formatted_name),
      phones: asArray(contact.phones).map((phone) => asString(phone.phone)),
    }));

    return {
      ...empty,
      type: 'contacts',
      body: contacts.map((contact) => contact.name).join(', '),
      payload: { contacts },
    };
  }

  if (type === 'interactive') {
    const interactive = asObject(raw.interactive) ?? {};
    const reply: Record<string, unknown> =
      asObject(interactive.button_reply) ?? asObject(interactive.list_reply) ?? {};

    return {
      ...empty,
      type: 'interactive',
      body: asString(reply.title),
      payload: {
        kind: asString(interactive.type),
        id: asString(reply.id),
        title: asString(reply.title),
        description: asString(reply.description),
      },
    };
  }

  if (type === 'button') {
    const button = asObject(raw.button) ?? {};

    return {
      ...empty,
      type: 'interactive',
      body: asString(button.text),
      payload: { kind: 'button', id: asString(button.payload), title: asString(button.text) },
    };
  }

  if (type === 'reaction') {
    const reaction = asObject(raw.reaction) ?? {};

    return {
      ...empty,
      type: 'reaction',
      body: asString(reaction.emoji),
      payload: { emoji: asString(reaction.emoji), messageId: asString(reaction.message_id) },
    };
  }

  return { ...empty, type: 'unsupported', body: '', payload: { type } };
}

function readStatuses(value: Record<string, unknown>): WaInboundStatus[] {
  return asArray(value.statuses)
    .map(readStatus)
    .filter((status): status is WaInboundStatus => status !== null);
}

function readStatus(raw: Record<string, unknown>): WaInboundStatus | null {
  const waMessageId = asString(raw.id);
  const status = asString(raw.status);

  if (waMessageId.length === 0 || !(WA_MESSAGE_STATUSES as readonly string[]).includes(status)) {
    return null;
  }

  const first = asArray(raw.errors)[0];

  return {
    waMessageId,
    status: status as WaMessageStatus,
    at: asDate(raw.timestamp),
    error: first
      ? {
          code: asString(first.code) || String(first.code ?? ''),
          title: asString(first.title),
          message: asString(first.message) || asString(asObject(first.error_data)?.details),
        }
      : null,
  };
}
