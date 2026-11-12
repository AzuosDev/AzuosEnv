import { TASK_PRIORITIES, TASK_TYPES, TaskPriority, TaskType } from '../tasks/task-fields';
import { MAX_PROPOSED_TASKS } from './ai-fields';

/** Schema sent to the model and used to validate what comes back. */
export const TASK_PROPOSAL_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['tasks'],
  properties: {
    tasks: {
      type: 'array',
      minItems: 1,
      maxItems: MAX_PROPOSED_TASKS,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 500 },
          descriptionText: { type: 'string', maxLength: 5000 },
          priority: { type: 'string', enum: [...TASK_PRIORITIES] },
          type: { type: 'string', enum: [...TASK_TYPES] },
          dueAt: { type: 'string', description: 'Data UTC ISO 8601.' },
          estimateMinutes: { type: 'integer', minimum: 0, maximum: 100_000 },
          points: { type: 'integer', minimum: 0, maximum: 1000 },
        },
      },
    },
  },
};

/** One task of the proposal, already validated against the schema. */
export interface ProposedTask {
  name: string;
  descriptionText?: string;
  priority?: TaskPriority;
  type?: TaskType;
  dueAt?: string;
  estimateMinutes?: number;
  points?: number;
}

export interface TaskProposalResult {
  tasks: ProposedTask[];
  /** Everything the model got wrong and was dropped, in Portuguese. */
  warnings: string[];
}

/**
 * Validates the answer of the model (or the body of the confirm endpoint) against
 * TASK_PROPOSAL_SCHEMA. An invalid optional field is dropped with a warning; a task
 * without a usable name is dropped whole, so nothing invalid ever reaches the create.
 */
export function validateTaskProposal(raw: unknown): TaskProposalResult {
  const warnings: string[] = [];
  const list = tasksOf(raw, warnings);
  const tasks: ProposedTask[] = [];

  for (const [index, item] of list.slice(0, MAX_PROPOSED_TASKS).entries()) {
    const task = toTask(item, index, warnings);

    if (task) {
      tasks.push(task);
    }
  }

  if (list.length > MAX_PROPOSED_TASKS) {
    warnings.push(`A proposta foi cortada em ${MAX_PROPOSED_TASKS} tarefas.`);
  }

  return { tasks, warnings };
}

function tasksOf(raw: unknown, warnings: string[]): unknown[] {
  if (raw === null || typeof raw !== 'object') {
    warnings.push('A IA não devolveu um objeto JSON.');

    return [];
  }

  const tasks = (raw as { tasks?: unknown }).tasks;

  if (!Array.isArray(tasks)) {
    warnings.push('A IA não devolveu a lista de tarefas.');

    return [];
  }

  return tasks;
}

function toTask(item: unknown, index: number, warnings: string[]): ProposedTask | null {
  if (item === null || typeof item !== 'object') {
    warnings.push(`A tarefa ${index + 1} não é um objeto.`);

    return null;
  }

  const source = item as Record<string, unknown>;
  const name = typeof source.name === 'string' ? source.name.trim() : '';

  if (name.length === 0 || name.length > 500) {
    warnings.push(`A tarefa ${index + 1} ficou sem nome válido e foi descartada.`);

    return null;
  }

  const task: ProposedTask = { name };
  const description = text(source.descriptionText, 5000);

  if (description) {
    task.descriptionText = description;
  }

  const priority = member(source.priority, TASK_PRIORITIES);

  if (priority) {
    task.priority = priority;
  } else if (source.priority !== undefined && source.priority !== null) {
    warnings.push(`Prioridade inválida na tarefa ${index + 1}.`);
  }

  const type = member(source.type, TASK_TYPES);

  if (type) {
    task.type = type;
  } else if (source.type !== undefined && source.type !== null) {
    warnings.push(`Tipo inválido na tarefa ${index + 1}.`);
  }

  const dueAt = isoDate(source.dueAt);

  if (dueAt) {
    task.dueAt = dueAt;
  } else if (source.dueAt !== undefined && source.dueAt !== null) {
    warnings.push(`Data inválida na tarefa ${index + 1}.`);
  }

  const estimate = integer(source.estimateMinutes, 0, 100_000);

  if (estimate !== null) {
    task.estimateMinutes = estimate;
  }

  const points = integer(source.points, 0, 1000);

  if (points !== null) {
    task.points = points;
  }

  return task;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const clean = value.trim();

  return clean.length === 0 ? null : clean.slice(0, max);
}

function member<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

function isoDate(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function integer(value: unknown, min: number, max: number): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < min || parsed > max) {
    return null;
  }

  return parsed;
}
