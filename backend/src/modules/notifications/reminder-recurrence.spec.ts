import { nextOccurrence } from './reminder-recurrence';

describe('nextOccurrence', () => {
  const now = new Date('2026-03-10T12:00:00.000Z');

  it('ends a reminder without recurrence', () => {
    expect(nextOccurrence(new Date('2026-03-10T11:00:00.000Z'), 'none', now)).toBeNull();
  });

  it('moves a daily reminder to the next day', () => {
    const next = nextOccurrence(new Date('2026-03-10T11:00:00.000Z'), 'daily', now);

    expect(next?.toISOString()).toBe('2026-03-11T11:00:00.000Z');
  });

  it('skips the days missed while the job was down', () => {
    const next = nextOccurrence(new Date('2026-03-01T11:00:00.000Z'), 'daily', now);

    expect(next?.toISOString()).toBe('2026-03-11T11:00:00.000Z');
  });

  it('moves a weekly reminder by seven days', () => {
    const next = nextOccurrence(new Date('2026-03-09T08:00:00.000Z'), 'weekly', now);

    expect(next?.toISOString()).toBe('2026-03-16T08:00:00.000Z');
  });

  it('moves a monthly reminder to the next month', () => {
    const next = nextOccurrence(new Date('2026-03-01T08:00:00.000Z'), 'monthly', now);

    expect(next?.toISOString()).toBe('2026-04-01T08:00:00.000Z');
  });
});
