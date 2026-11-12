import type {
  ActionType,
  AutomationLocationType,
  AutomationRunStatus,
  ConditionOp,
  TriggerType,
} from '@/api/types';
import type { StatusTone } from '@/components/ui/status-pill';

export const TRIGGER_TYPES: TriggerType[] = [
  'taskCreated',
  'statusChanged',
  'assigneeChanged',
  'priorityChanged',
  'dueDateArrived',
  'dueDatePassed',
  'allSubtasksDone',
  'formSubmitted',
  'webhookReceived',
  'schedule',
];

export const TRIGGER_LABEL: Record<TriggerType, string> = {
  taskCreated: 'Tarefa criada',
  statusChanged: 'Status muda',
  assigneeChanged: 'Responsável muda',
  priorityChanged: 'Prioridade muda',
  dueDateArrived: 'Prazo chega',
  dueDatePassed: 'Prazo passa',
  allSubtasksDone: 'Todas as subtarefas concluídas',
  formSubmitted: 'Formulário enviado',
  webhookReceived: 'Webhook recebido',
  schedule: 'Em horário agendado',
};

export const ACTION_TYPES: ActionType[] = [
  'setStatus',
  'assign',
  'unassign',
  'setPriority',
  'addComment',
  'moveToList',
  'addTag',
  'setCustomField',
  'createTask',
  'applyTemplate',
  'notify',
  'callWebhook',
];

export const ACTION_LABEL: Record<ActionType, string> = {
  setStatus: 'Mudar status',
  assign: 'Atribuir responsáveis',
  unassign: 'Remover responsáveis',
  setPriority: 'Mudar prioridade',
  addComment: 'Comentar',
  moveToList: 'Mover para outra List',
  addTag: 'Adicionar tags',
  setCustomField: 'Preencher campo personalizado',
  createTask: 'Criar tarefa',
  applyTemplate: 'Aplicar template',
  notify: 'Notificar pessoas',
  callWebhook: 'Chamar webhook',
};

export const CONDITION_OPS: ConditionOp[] = [
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
];

export const CONDITION_OP_LABEL: Record<ConditionOp, string> = {
  eq: 'é igual a',
  ne: 'é diferente de',
  contains: 'contém',
  notContains: 'não contém',
  gt: 'é maior que',
  lt: 'é menor que',
  in: 'está em',
  nin: 'não está em',
  isEmpty: 'está vazio',
  isNotEmpty: 'não está vazio',
};

/** Operadores que dispensam valor. */
export const UNARY_OPS: ConditionOp[] = ['isEmpty', 'isNotEmpty'];

/** Campos da tarefa que a condição oferece prontos. */
export const CONDITION_FIELDS = [
  { value: 'name', label: 'Nome' },
  { value: 'statusGroup', label: 'Grupo do status' },
  { value: 'priority', label: 'Prioridade' },
  { value: 'assigneeIds', label: 'Responsáveis' },
  { value: 'tagIds', label: 'Tags' },
  { value: 'points', label: 'Pontos' },
  { value: 'estimateMinutes', label: 'Estimativa (minutos)' },
] as const;

export const LOCATION_TYPE_LABEL: Record<AutomationLocationType, string> = {
  space: 'Space',
  folder: 'Folder',
  list: 'List',
};

export const RUN_STATUS_LABEL: Record<AutomationRunStatus, string> = {
  success: 'Executada',
  failed: 'Falhou',
  skipped: 'Ignorada',
};

export const RUN_STATUS_TONE: Record<AutomationRunStatus, StatusTone> = {
  success: 'success',
  failed: 'danger',
  skipped: 'neutral',
};

/** Campos dinâmicos que cada gatilho pede. */
export type TriggerField = 'toStatus' | 'beforeMinutes' | 'cron';

export const TRIGGER_FIELDS: Record<TriggerType, TriggerField[]> = {
  taskCreated: [],
  statusChanged: ['toStatus'],
  assigneeChanged: [],
  priorityChanged: [],
  dueDateArrived: ['beforeMinutes'],
  dueDatePassed: [],
  allSubtasksDone: [],
  formSubmitted: [],
  webhookReceived: [],
  schedule: ['cron'],
};

/** Campos dinâmicos que cada ação pede. */
export type ActionField =
  | 'status'
  | 'users'
  | 'priority'
  | 'comment'
  | 'list'
  | 'tags'
  | 'customField'
  | 'taskName'
  | 'template'
  | 'message'
  | 'webhook';

export const ACTION_FIELDS: Record<ActionType, ActionField[]> = {
  setStatus: ['status'],
  assign: ['users'],
  unassign: ['users'],
  setPriority: ['priority'],
  addComment: ['comment'],
  moveToList: ['list'],
  addTag: ['tags'],
  setCustomField: ['customField'],
  createTask: ['list', 'taskName', 'priority', 'users'],
  applyTemplate: ['template', 'list'],
  notify: ['users', 'message'],
  callWebhook: ['webhook'],
};
