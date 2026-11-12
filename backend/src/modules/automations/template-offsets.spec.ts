import { interpolate } from './automation-templating';
import { dateFromOffset, isoFromOffset, offsetMinutesOf } from './template-offsets';

const anchor = new Date('2026-03-02T09:00:00.000Z');

describe('template-offsets', () => {
  it('stores a date as minutes from the anchor and reads it back', () => {
    const due = new Date('2026-03-05T09:00:00.000Z');
    const offset = offsetMinutesOf(due, anchor);

    expect(offset).toBe(3 * 24 * 60);
    expect(dateFromOffset(offset, anchor)?.toISOString()).toBe(due.toISOString());
  });

  it('keeps a date before the anchor as a negative offset', () => {
    expect(offsetMinutesOf(new Date('2026-03-02T08:30:00.000Z'), anchor)).toBe(-30);
  });

  it('shifts the whole plan when the anchor moves', () => {
    const offset = offsetMinutesOf(new Date('2026-03-04T09:00:00.000Z'), anchor);

    expect(isoFromOffset(offset, new Date('2026-06-01T09:00:00.000Z'))).toBe(
      '2026-06-03T09:00:00.000Z',
    );
  });

  it('leaves a task without dates without dates', () => {
    expect(offsetMinutesOf(null, anchor)).toBeNull();
    expect(dateFromOffset(null, anchor)).toBeNull();
    expect(isoFromOffset(null, anchor)).toBeUndefined();
  });
});

describe('automation-templating', () => {
  const facts = { task: { customId: 'AZD-142' }, payload: { name: 'Novo lead', count: 3 } };

  it('replaces a placeholder inside a sentence', () => {
    expect(interpolate('Tarefa {{task.customId}} pronta.', facts)).toBe('Tarefa AZD-142 pronta.');
  });

  it('keeps the raw type when the placeholder is the whole string', () => {
    expect(interpolate('{{payload.count}}', facts)).toBe(3);
  });

  it('walks into objects and arrays and blanks what is missing', () => {
    expect(interpolate({ name: '{{payload.name}}', tags: ['{{payload.missing}}'] }, facts)).toEqual(
      { name: 'Novo lead', tags: [''] },
    );
  });
});
