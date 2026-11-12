import { createHmac } from 'node:crypto';
import { safeEqual } from '../../../common/utils/crypto';
import { MAX_DELIVERY_ATTEMPTS } from './webhook-fields';

/** `sha256=<hex>` of the body, the same shape GitHub uses. */
export function signBody(body: string | Buffer, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

/** Constant-time check of a received signature. */
export function verifyBody(
  body: string | Buffer,
  secret: string,
  signature: string | undefined,
): boolean {
  if (!signature) {
    return false;
  }

  return safeEqual(signBody(body, secret), signature.trim());
}

/**
 * Backoff of the retries: 5 s, 25 s, 2 min, 10 min. `attempt` is how many tries
 * already failed, so the first retry waits the shortest window.
 */
export function backoffDelayMs(attempt: number): number {
  const steps = [5_000, 25_000, 125_000, 625_000];
  const index = Math.min(Math.max(attempt - 1, 0), steps.length - 1);

  return steps[index];
}

export function hasAttemptsLeft(attempts: number): boolean {
  return attempts < MAX_DELIVERY_ATTEMPTS;
}
