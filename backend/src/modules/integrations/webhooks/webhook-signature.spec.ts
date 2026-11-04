import { backoffDelayMs, hasAttemptsLeft, signBody, verifyBody } from './webhook-signature';

describe('webhook-signature', () => {
  const body = JSON.stringify({ event: 'task.created' });
  const secret = 'segredo-do-webhook';

  it('signs with the sha256= prefix and verifies the same body', () => {
    const signature = signBody(body, secret);

    expect(signature).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(verifyBody(body, secret, signature)).toBe(true);
    expect(verifyBody(Buffer.from(body, 'utf8'), secret, signature)).toBe(true);
  });

  it('refuses another secret, another body, a missing or a truncated signature', () => {
    const signature = signBody(body, secret);

    expect(verifyBody(body, 'outro', signature)).toBe(false);
    expect(verifyBody(`${body} `, secret, signature)).toBe(false);
    expect(verifyBody(body, secret, undefined)).toBe(false);
    expect(verifyBody(body, secret, signature.slice(0, -2))).toBe(false);
  });

  it('grows the backoff and stops at the last step', () => {
    expect(backoffDelayMs(1)).toBe(5_000);
    expect(backoffDelayMs(2)).toBe(25_000);
    expect(backoffDelayMs(3)).toBe(125_000);
    expect(backoffDelayMs(4)).toBe(625_000);
    expect(backoffDelayMs(9)).toBe(625_000);
  });

  it('allows five attempts in total', () => {
    expect(hasAttemptsLeft(4)).toBe(true);
    expect(hasAttemptsLeft(5)).toBe(false);
  });
});
