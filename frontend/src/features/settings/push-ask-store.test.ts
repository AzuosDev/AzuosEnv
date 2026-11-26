import { beforeEach, describe, expect, it } from 'vitest';
import { pushAskSnoozed, SNOOZE_DAYS, snoozePushAsk } from './push-ask-store';

const DAY = 24 * 60 * 60 * 1000;

describe('push-ask-store', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('sem marca o convite aparece', () => {
    expect(pushAskSnoozed()).toBe(false);
  });

  it('adiar vale por duas semanas e depois o convite volta', () => {
    const now = new Date('2026-01-10T12:00:00Z');

    snoozePushAsk(now);

    expect(pushAskSnoozed(new Date(now.getTime() + DAY))).toBe(true);
    expect(pushAskSnoozed(new Date(now.getTime() + (SNOOZE_DAYS - 1) * DAY))).toBe(true);
    expect(pushAskSnoozed(new Date(now.getTime() + (SNOOZE_DAYS + 1) * DAY))).toBe(false);
  });

  it('marca inválida no storage não prende o convite', () => {
    window.localStorage.setItem('azuos-env:push-ask', 'ontem');

    expect(pushAskSnoozed()).toBe(false);
  });
});
