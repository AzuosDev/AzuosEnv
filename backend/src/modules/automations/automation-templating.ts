import { AutomationFacts, readFact } from './automation-conditions';

const PLACEHOLDER = /\{\{\s*([\w.:-]+)\s*\}\}/g;

/**
 * Replaces `{{task.name}}` or `{{payload.email}}` in the params of an action with
 * the facts of the event. A placeholder alone in the string keeps the raw type, so
 * `{{payload.taskId}}` can still be read as an id.
 */
export function interpolate(value: unknown, facts: AutomationFacts): unknown {
  if (typeof value === 'string') {
    return interpolateString(value, facts);
  }

  if (Array.isArray(value)) {
    return value.map((item) => interpolate(item, facts));
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        interpolate(item, facts),
      ]),
    );
  }

  return value;
}

export function interpolateParams(
  params: Record<string, unknown>,
  facts: AutomationFacts,
): Record<string, unknown> {
  return interpolate(params, facts) as Record<string, unknown>;
}

function interpolateString(value: string, facts: AutomationFacts): unknown {
  const whole = /^\{\{\s*([\w.:-]+)\s*\}\}$/.exec(value);

  if (whole) {
    const fact = readFact(facts, whole[1]);

    return fact === undefined ? '' : fact;
  }

  return value.replace(PLACEHOLDER, (_match, field: string) => {
    const fact = readFact(facts, field);

    if (fact === null || fact === undefined) {
      return '';
    }

    return fact instanceof Date ? fact.toISOString() : String(fact);
  });
}
