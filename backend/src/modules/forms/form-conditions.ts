import { FormConditionOp } from './form-fields';

export interface ConditionLike {
  fieldId: string;
  op: FormConditionOp;
  value?: unknown;
  showFieldIds: string[];
}

function asText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  return Array.isArray(value) ? value.map((item) => String(item)).join(',') : String(value);
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number.parseFloat(asText(value));
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined || value === '') {
    return true;
  }

  return Array.isArray(value) && value.length === 0;
}

/** Whether the answer satisfies one condition of the form. */
export function matchesCondition(condition: ConditionLike, answer: unknown): boolean {
  switch (condition.op) {
    case 'eq':
      return asText(answer) === asText(condition.value);
    case 'ne':
      return asText(answer) !== asText(condition.value);
    case 'contains':
      return asText(answer).toLowerCase().includes(asText(condition.value).toLowerCase());
    case 'gt':
      return asNumber(answer) > asNumber(condition.value);
    case 'lt':
      return asNumber(answer) < asNumber(condition.value);
    case 'isEmpty':
      return isEmpty(answer);
    case 'isNotEmpty':
      return !isEmpty(answer);
  }
}

/**
 * Which questions the respondent actually sees. A question named by any condition
 * starts hidden and shows up once one of the conditions that reveal it matches;
 * every other question is always visible.
 */
export function visibleFieldIds(
  fieldIds: string[],
  conditions: ConditionLike[],
  values: Record<string, unknown>,
): Set<string> {
  const conditional = new Set(conditions.flatMap((condition) => condition.showFieldIds));
  const visible = new Set(fieldIds.filter((fieldId) => !conditional.has(fieldId)));

  for (const condition of conditions) {
    if (!matchesCondition(condition, values[condition.fieldId])) {
      continue;
    }

    for (const fieldId of condition.showFieldIds) {
      if (fieldIds.includes(fieldId)) {
        visible.add(fieldId);
      }
    }
  }

  return visible;
}
