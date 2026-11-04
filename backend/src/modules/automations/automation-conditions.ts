export const CONDITION_OPS = [
  'eq',
  'ne',
  'contains',
  'notContains',
  'gt',
  'lt',
  'in',
  'nin',
  'isEmpty',
  'isNotEmpty',
] as const;
export type ConditionOp = (typeof CONDITION_OPS)[number];

export interface AutomationConditionInput {
  field: string;
  op: ConditionOp;
  value?: unknown;
}

/**
 * What a condition can read: the fields of the task, `field:<id>` for a custom
 * field and `payload.<path>` for the body of a webhook or form.
 */
export type AutomationFacts = Record<string, unknown>;

/** Reads `a.b.c` from the facts, with the whole key tried first (`field:<id>`). */
export function readFact(facts: AutomationFacts, field: string): unknown {
  if (field in facts) {
    return facts[field];
  }

  return field.split('.').reduce<unknown>((current, part) => {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }

    return (current as Record<string, unknown>)[part];
  }, facts);
}

export function matchesAll(
  facts: AutomationFacts,
  conditions: AutomationConditionInput[],
): boolean {
  return conditions.every((condition) => matchesCondition(facts, condition));
}

export function matchesCondition(
  facts: AutomationFacts,
  condition: AutomationConditionInput,
): boolean {
  const actual = readFact(facts, condition.field);
  const expected = condition.value;

  switch (condition.op) {
    case 'isEmpty':
      return isEmpty(actual);
    case 'isNotEmpty':
      return !isEmpty(actual);
    case 'eq':
      return equals(actual, expected);
    case 'ne':
      return !equals(actual, expected);
    case 'contains':
      return contains(actual, expected);
    case 'notContains':
      return !contains(actual, expected);
    case 'in':
      return toList(expected).some((one) => equals(actual, one) || contains(actual, one));
    case 'nin':
      return !toList(expected).some((one) => equals(actual, one) || contains(actual, one));
    case 'gt':
      return compare(actual, expected) > 0;
    case 'lt':
      return compare(actual, expected) < 0;
  }
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return value === '';
}

/** An array equals the expected value when it holds exactly that one element. */
function equals(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(actual)) {
    if (Array.isArray(expected)) {
      return (
        actual.length === expected.length &&
        actual.every((item, index) => equals(item, expected[index]))
      );
    }

    return actual.length === 1 && equals(actual[0], expected);
  }

  if (actual instanceof Date || expected instanceof Date) {
    const left = toTime(actual);
    const right = toTime(expected);

    return left !== null && right !== null && left === right;
  }

  if (typeof actual === 'number' || typeof expected === 'number') {
    const left = toNumber(actual);
    const right = toNumber(expected);

    if (left !== null && right !== null) {
      return left === right;
    }
  }

  if (typeof actual === 'boolean' || typeof expected === 'boolean') {
    return Boolean(actual) === Boolean(expected);
  }

  return text(actual) === text(expected);
}

/** Membership for arrays, substring for text. */
function contains(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(actual)) {
    return actual.some((item) => equals(item, expected));
  }

  if (isEmpty(actual) || expected === null || expected === undefined) {
    return false;
  }

  return text(actual).toLowerCase().includes(text(expected).toLowerCase());
}

/** -1, 0 or 1; NaN-free comparison over numbers, dates and text. */
function compare(actual: unknown, expected: unknown): number {
  const left = toTime(actual) ?? toNumber(actual);
  const right = toTime(expected) ?? toNumber(expected);

  if (left !== null && right !== null) {
    return left === right ? 0 : left > right ? 1 : -1;
  }

  const leftText = text(actual);
  const rightText = text(expected);

  return leftText === rightText ? 0 : leftText > rightText ? 1 : -1;
}

function toList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

/** Milliseconds of a Date or of an ISO 8601 string; null for anything else. */
function toTime(value: unknown): number | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime();
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}([T ]|$)/.test(value)) {
    const parsed = new Date(value).getTime();

    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function text(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}
