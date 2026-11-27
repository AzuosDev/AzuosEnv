/**
 * JIDs of the Baileys protocol, which is what Evolution hands us. Everything
 * here is pure, so the rules are covered by unit test.
 */

/** Suffix of a group chat; the module never answers a group. */
const GROUP_SUFFIX = '@g.us';

/** Suffix of the status/stories feed and of broadcast lists. */
const BROADCAST_SUFFIX = '@broadcast';

/** Suffix of a person. */
const USER_SUFFIX = '@s.whatsapp.net';

export function isGroupJid(jid: string): boolean {
  return jid.endsWith(GROUP_SUFFIX);
}

export function isBroadcastJid(jid: string): boolean {
  return jid.endsWith(BROADCAST_SUFFIX);
}

/** True for everything the attendance must not treat as a conversation. */
export function isIgnorableJid(jid: string): boolean {
  return jid.length === 0 || isGroupJid(jid) || isBroadcastJid(jid);
}

/**
 * Number of a JID, in the same shape the Cloud API calls `wa_id`: digits only,
 * with the country code. The `:device` part of a multi-device JID is dropped.
 */
export function waIdFromJid(jid: string): string {
  const [user = ''] = jid.split('@');
  const [number = ''] = user.split(':');

  return number.replace(/\D/g, '');
}

export function jidFromWaId(waId: string): string {
  return `${waId}${USER_SUFFIX}`;
}

/** Brazilian numbers: 55 + two digits of area code + 8 or 9 digits. */
const BRAZIL_NUMBER = /^55(\d{2})(\d{8,9})$/;

/**
 * The two shapes a Brazilian mobile number is written in. WhatsApp kept the
 * older eight-digit JID for numbers registered before the ninth digit, so a
 * number typed by hand only reaches the contact in one of the two forms; which
 * one it is has to be asked to the provider before anything is sent.
 *
 * The first entry is always the number as it was typed. A landline (the old
 * eight digits open with 2 to 5) and anything that is not Brazilian answer only
 * themselves, since neither ever gained a ninth digit.
 */
export function brazilNumberVariants(waId: string): string[] {
  const digits = waId.replace(/\D/g, '');
  const match = BRAZIL_NUMBER.exec(digits);

  if (!match) {
    return [digits];
  }

  const [, area = '', rest = ''] = match;

  if (rest.length === 9) {
    // Only a 9 opening the number is the ninth digit.
    return rest.startsWith('9') ? [digits, `55${area}${rest.slice(1)}`] : [digits];
  }

  return /^[6-9]/.test(rest) ? [digits, `55${area}9${rest}`] : [digits];
}
