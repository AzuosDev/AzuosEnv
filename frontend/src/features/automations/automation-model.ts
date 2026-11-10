import type {
  Automation,
  AutomationActionInput,
  AutomationConditionInput,
  AutomationRecipe,
  AutomationTriggerInput,
  TaskPriority,
} from '@/api/types';
import { ACTION_LABEL, CONDITION_OP_LABEL, TRIGGER_LABEL, UNARY_OPS } from './automation-fields';

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  urgent: 'urgente',
  high: 'alta',
  normal: 'normal',
  low: 'baixa',
};

const STATUS_GROUP_LABEL: Record<string, string> = {
  notStarted: 'não iniciado',
  active: 'em andamento',
  done: 'concluído',
  closed: 'fechado',
};

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function count(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function params(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/** Frase do gatilho, com o detalhe que ele guarda. */
export function describeTrigger(trigger: {
  type: Automation['trigger']['type'];
  params?: unknown;
}): string {
  const base = TRIGGER_LABEL[trigger.type];
  const config = params(trigger.params);

  if (trigger.type === 'statusChanged') {
    const group = text(config.toStatusGroup);

    if (group) {
      return `${base} para ${STATUS_GROUP_LABEL[group] ?? group}`;
    }

    return text(config.toStatusId) ? `${base} para o status escolhido` : base;
  }

  if (trigger.type === 'dueDateArrived' && typeof config.beforeMinutes === 'number') {
    const minutes = config.beforeMinutes;

    if (minutes >= 1440) {
      const days = Math.round(minutes / 1440);

      return `${base} em ${String(days)} ${days === 1 ? 'dia' : 'dias'}`;
    }

    return minutes > 0 ? `${base} em ${String(minutes)} min` : base;
  }

  if (trigger.type === 'schedule') {
    const cron = text(config.cron);

    return cron ? `${base} (${cron})` : base;
  }

  return base;
}

/** Frase da ação, com o detalhe que ela guarda. */
export function describeAction(action: {
  type: Automation['actions'][number]['type'];
  params?: unknown;
}): string {
  const base = ACTION_LABEL[action.type];
  const config = params(action.params);

  if (action.type === 'setStatus') {
    const group = text(config.statusGroup);

    return group ? `${base} para ${STATUS_GROUP_LABEL[group] ?? group}` : base;
  }

  if (action.type === 'setPriority') {
    const priority = text(config.priority);

    return priority ? `${base} para ${PRIORITY_LABEL[priority as TaskPriority]}` : base;
  }

  if (action.type === 'assign' || action.type === 'unassign' || action.type === 'notify') {
    const people = count(config.userIds);

    return people > 0 ? `${base} (${String(people)})` : base;
  }

  if (action.type === 'addTag') {
    const tags = count(config.tagIds);

    return tags > 0 ? `${base} (${String(tags)})` : base;
  }

  if (action.type === 'createTask') {
    const name = text(config.name);

    return name ? `${base} "${name}"` : base;
  }

  if (action.type === 'callWebhook') {
    const url = text(config.url);

    return url ? `${base} ${url}` : base;
  }

  return base;
}

/** Frase da condição, lida da esquerda para a direita. */
export function describeCondition(condition: AutomationConditionInput): string {
  const operator = CONDITION_OP_LABEL[condition.op];

  if (UNARY_OPS.includes(condition.op)) {
    return `${condition.field} ${operator}`;
  }

  const value = Array.isArray(condition.value)
    ? condition.value.join(', ')
    : String(condition.value ?? '');

  return `${condition.field} ${operator} ${value}`;
}

export interface AutomationSentence {
  when: string;
  conditions: string[];
  then: string;
}

/** Quando → Se → Então da automação, pronto para a linha da lista. */
export function describeAutomation(automation: Automation): AutomationSentence {
  return {
    when: describeTrigger(automation.trigger),
    conditions: automation.conditions.map((condition) =>
      describeCondition(condition as AutomationConditionInput),
    ),
    then: automation.actions.map((action) => describeAction(action)).join(' · '),
  };
}

/** O que falta preencher na receita antes de salvar, em caminhos do corpo. */
export function missingRecipeFields(
  recipe: AutomationRecipe,
  trigger: AutomationTriggerInput,
  actions: AutomationActionInput[],
): string[] {
  return recipe.requires.filter((path) => {
    const parts = path.split('.');
    const root: unknown = parts[0] === 'trigger' ? trigger : actions;
    let current: unknown = root;

    for (const part of parts.slice(1)) {
      if (current === null || typeof current !== 'object') {
        return true;
      }

      current = (current as Record<string, unknown>)[part];
    }

    if (current === null || current === undefined || current === '') {
      return true;
    }

    return Array.isArray(current) && current.length === 0;
  });
}

/** Corpo inicial do construtor a partir de uma receita. */
export function recipeDraft(recipe: AutomationRecipe): {
  name: string;
  trigger: AutomationTriggerInput;
  conditions: AutomationConditionInput[];
  actions: AutomationActionInput[];
} {
  return {
    name: recipe.name,
    trigger: {
      type: recipe.trigger.type,
      params: { ...recipe.trigger.params } as AutomationTriggerInput['params'],
    },
    conditions: recipe.conditions.map((condition) => ({ ...condition })),
    actions: recipe.actions.map((action) => ({
      type: action.type,
      params: { ...action.params } as AutomationActionInput['params'],
    })),
  };
}

/** Automações agrupadas por local, na ordem em que a lista mostra. */
export function groupByLocation(automations: Automation[]): {
  key: string;
  locationType: Automation['locationType'];
  locationId: string;
  items: Automation[];
}[] {
  const groups = new Map<string, Automation[]>();

  for (const automation of automations) {
    const key = `${automation.locationType}:${automation.locationId}`;

    groups.set(key, [...(groups.get(key) ?? []), automation]);
  }

  return [...groups.entries()].map(([key, items]) => {
    const [locationType, locationId] = key.split(':');

    return {
      key,
      locationType: (locationType ?? 'space') as Automation['locationType'],
      locationId: locationId ?? '',
      items,
    };
  });
}
