import { matchesContains, matchesKeyword, matchesRegex } from './whatsapp-bot-text';
import { WA_CONTEXT_TRIGGERS, WaBotTrigger } from './whatsapp-fields';

/** Only what deciding a rule needs; keeps the matching free of Mongoose. */
export interface WaRuleLike {
  trigger: { kind: WaBotTrigger; value: string };
  priority: number;
  active: boolean;
  /** Tiebreaker between rules of the same priority: the oldest wins. */
  order: string;
}

export interface WaInboundFacts {
  /** Text of the message, or the title of the chosen option. */
  text: string;
  /** Id of the button or list row the contact tapped. */
  optionId: string | null;
  /** True when this is the only inbound message of the conversation. */
  firstMessage: boolean;
  /** True when the message landed outside the hours of attendance. */
  outsideHours: boolean;
}

/** Highest priority first, then the oldest rule. */
export function sortWaRules<T extends WaRuleLike>(rules: T[]): T[] {
  return [...rules].sort(
    (left, right) => right.priority - left.priority || left.order.localeCompare(right.order),
  );
}

function fires(rule: WaRuleLike, facts: WaInboundFacts): boolean {
  const { kind, value } = rule.trigger;

  if (kind === 'firstMessage') {
    return facts.firstMessage;
  }

  if (kind === 'outsideHours') {
    return facts.outsideHours;
  }

  if (kind === 'menuOption') {
    return facts.optionId !== null && facts.optionId === value;
  }

  if (kind === 'keyword') {
    return matchesKeyword(facts.text, value);
  }

  if (kind === 'contains') {
    return matchesContains(facts.text, value);
  }

  return matchesRegex(facts.text, value);
}

/**
 * Rule that answers this message, or null when none does. `firstMessage` and
 * `outsideHours` are picked by `matchWaContextRule`, so a keyword rule never
 * steals the greeting.
 */
export function matchWaRule<T extends WaRuleLike>(rules: T[], facts: WaInboundFacts): T | null {
  for (const rule of sortWaRules(rules)) {
    if (!rule.active || WA_CONTEXT_TRIGGERS.includes(rule.trigger.kind)) {
      continue;
    }

    if (fires(rule, facts)) {
      return rule;
    }
  }

  return null;
}

/** Rule of a moment of the conversation: the first message or the closed hours. */
export function matchWaContextRule<T extends WaRuleLike>(
  rules: T[],
  trigger: 'firstMessage' | 'outsideHours',
  facts: WaInboundFacts,
): T | null {
  for (const rule of sortWaRules(rules)) {
    if (rule.active && rule.trigger.kind === trigger && fires(rule, facts)) {
      return rule;
    }
  }

  return null;
}
