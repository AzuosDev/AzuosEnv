/** Domain events an outgoing webhook may subscribe to; `*` takes all of them. */
export const OUTGOING_WEBHOOK_EVENTS = [
  '*',
  'task.created',
  'task.updated',
  'task.moved',
  'task.deleted',
  'comment.created',
  'message.created',
  'whiteboard.updated',
] as const;
export type OutgoingWebhookEvent = (typeof OUTGOING_WEBHOOK_EVENTS)[number];

export const WEBHOOK_DELIVERY_STATUSES = ['pending', 'success', 'failed'] as const;
export type WebhookDeliveryStatus = (typeof WEBHOOK_DELIVERY_STATUSES)[number];

/** Attempts per delivery, the first one included. */
export const MAX_DELIVERY_ATTEMPTS = 5;

/** Bytes of the signing secret of a webhook. */
export const WEBHOOK_SECRET_BYTES = 32;

export const WEBHOOK_TIMEOUT_MS = 10_000;

/** Deliveries retried per cycle of the cron. */
export const MAX_DELIVERY_BATCH = 50;

/** Header carrying the HMAC of the body. */
export const SIGNATURE_HEADER = 'X-Azuos-Signature-256';
export const EVENT_HEADER = 'X-Azuos-Event';
export const DELIVERY_HEADER = 'X-Azuos-Delivery';

export const MAX_WEBHOOKS_PER_WORKSPACE = 50;
