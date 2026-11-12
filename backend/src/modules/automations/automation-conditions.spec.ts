import { AutomationFacts, matchesAll, matchesCondition, readFact } from './automation-conditions';

const facts: AutomationFacts = {
  name: 'Corrigir fechamento de caixa',
  statusGroup: 'active',
  priority: null,
  points: 5,
  assigneeIds: ['6512f1a0f1a0f1a0f1a0f1a0'],
  dueAt: new Date('2026-03-10T12:00:00.000Z'),
  'field:6512f1a0f1a0f1a0f1a0f1b1': 'uSolutions',
  payload: { email: 'cliente@azuos.dev', nested: { plan: 'pro' } },
};

describe('automation-conditions', () => {
  it('reads a dotted path and a custom field key', () => {
    expect(readFact(facts, 'payload.nested.plan')).toBe('pro');
    expect(readFact(facts, 'field:6512f1a0f1a0f1a0f1a0f1b1')).toBe('uSolutions');
    expect(readFact(facts, 'payload.missing')).toBeUndefined();
  });

  it('treats null, empty string and empty array as empty', () => {
    expect(matchesCondition(facts, { field: 'priority', op: 'isEmpty' })).toBe(true);
    expect(matchesCondition(facts, { field: 'name', op: 'isNotEmpty' })).toBe(true);
    expect(matchesCondition({ tagIds: [] }, { field: 'tagIds', op: 'isEmpty' })).toBe(true);
  });

  it('compares an array by membership and text by substring', () => {
    expect(
      matchesCondition(facts, {
        field: 'assigneeIds',
        op: 'contains',
        value: '6512f1a0f1a0f1a0f1a0f1a0',
      }),
    ).toBe(true);
    expect(matchesCondition(facts, { field: 'name', op: 'contains', value: 'CAIXA' })).toBe(true);
    expect(matchesCondition(facts, { field: 'name', op: 'notContains', value: 'nota' })).toBe(true);
  });

  it('keeps nin true for a group outside the list', () => {
    expect(
      matchesCondition(facts, { field: 'statusGroup', op: 'nin', value: ['done', 'closed'] }),
    ).toBe(true);
    expect(
      matchesCondition(facts, { field: 'statusGroup', op: 'in', value: ['active', 'notStarted'] }),
    ).toBe(true);
  });

  it('orders numbers and dates instead of their text', () => {
    expect(matchesCondition(facts, { field: 'points', op: 'gt', value: 3 })).toBe(true);
    expect(matchesCondition(facts, { field: 'points', op: 'lt', value: 10 })).toBe(true);
    expect(
      matchesCondition(facts, { field: 'dueAt', op: 'lt', value: '2026-03-11T00:00:00.000Z' }),
    ).toBe(true);
    expect(
      matchesCondition(facts, { field: 'dueAt', op: 'gt', value: '2026-03-11T00:00:00.000Z' }),
    ).toBe(false);
  });

  it('requires every condition to pass', () => {
    expect(
      matchesAll(facts, [
        { field: 'statusGroup', op: 'eq', value: 'active' },
        { field: 'payload.nested.plan', op: 'eq', value: 'pro' },
      ]),
    ).toBe(true);
    expect(
      matchesAll(facts, [
        { field: 'statusGroup', op: 'eq', value: 'active' },
        { field: 'priority', op: 'eq', value: 'urgent' },
      ]),
    ).toBe(false);
  });

  it('passes with no conditions at all', () => {
    expect(matchesAll(facts, [])).toBe(true);
  });
});
