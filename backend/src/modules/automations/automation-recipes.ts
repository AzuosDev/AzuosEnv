import { ConditionOp } from './automation-conditions';
import { ActionType, AutomationLocationType, TriggerType } from './automation-fields';

/**
 * Ready-made automations the front offers in one click. Each recipe is the body of
 * POST /automations with the fields of `requires` still to be filled in.
 */
export interface AutomationRecipe {
  key: string;
  name: string;
  description: string;
  locationTypes: AutomationLocationType[];
  trigger: { type: TriggerType; params: Record<string, unknown> };
  conditions: { field: string; op: ConditionOp; value?: unknown }[];
  actions: { type: ActionType; params: Record<string, unknown> }[];
  /** Params the user must fill before the recipe can be saved. */
  requires: string[];
}

const EVERYWHERE: AutomationLocationType[] = ['space', 'folder', 'list'];

export const AUTOMATION_RECIPES: AutomationRecipe[] = [
  {
    key: 'assignOnCreate',
    name: 'Atribuir ao criar',
    description: 'Toda tarefa nova do local já nasce com os responsáveis escolhidos.',
    locationTypes: EVERYWHERE,
    trigger: { type: 'taskCreated', params: {} },
    conditions: [],
    actions: [{ type: 'assign', params: { userIds: [] } }],
    requires: ['actions.0.params.userIds'],
  },
  {
    key: 'reviewerOnStatus',
    name: 'Ao mudar status, atribuir revisor',
    description: 'Quando a tarefa chega ao status escolhido, o revisor entra como responsável.',
    locationTypes: EVERYWHERE,
    trigger: { type: 'statusChanged', params: { toStatusId: null } },
    conditions: [],
    actions: [
      { type: 'assign', params: { userIds: [] } },
      { type: 'addComment', params: { bodyText: 'Tarefa {{task.customId}} pronta para revisão.' } },
    ],
    requires: ['trigger.params.toStatusId', 'actions.0.params.userIds'],
  },
  {
    key: 'notifyBeforeDue',
    name: 'Avisar no prazo',
    description: 'Um dia antes do prazo, os responsáveis recebem um aviso no inbox.',
    locationTypes: EVERYWHERE,
    trigger: { type: 'dueDateArrived', params: { beforeMinutes: 1440 } },
    conditions: [{ field: 'statusGroup', op: 'nin', value: ['done', 'closed'] }],
    actions: [{ type: 'notify', params: { message: 'A tarefa {{task.customId}} vence amanhã.' } }],
    requires: [],
  },
  {
    key: 'urgentWhenOverdue',
    name: 'Prioridade urgente quando vencer',
    description: 'Tarefa aberta que passou do prazo vira urgente.',
    locationTypes: EVERYWHERE,
    trigger: { type: 'dueDatePassed', params: {} },
    conditions: [{ field: 'statusGroup', op: 'nin', value: ['done', 'closed'] }],
    actions: [{ type: 'setPriority', params: { priority: 'urgent' } }],
    requires: [],
  },
  {
    key: 'parentDoneOnSubtasks',
    name: 'Subtarefas concluídas fecham a tarefa-pai',
    description: 'Quando a última subtarefa é concluída, a tarefa-pai vai para concluído.',
    locationTypes: EVERYWHERE,
    trigger: { type: 'allSubtasksDone', params: {} },
    conditions: [],
    actions: [{ type: 'setStatus', params: { statusGroup: 'done' } }],
    requires: [],
  },
  {
    key: 'formToTask',
    name: 'Formulário vira tarefa',
    description: 'Cada envio do formulário cria uma tarefa na List escolhida.',
    locationTypes: EVERYWHERE,
    trigger: { type: 'formSubmitted', params: {} },
    conditions: [],
    actions: [
      {
        type: 'createTask',
        params: { listId: null, name: '{{payload.name}}', priority: 'normal' },
      },
    ],
    requires: ['actions.0.params.listId'],
  },
  {
    key: 'scheduledDigest',
    name: 'Resumo agendado',
    description: 'Toda segunda às 8h o time recebe o resumo da semana no inbox.',
    locationTypes: EVERYWHERE,
    trigger: { type: 'schedule', params: { cron: '0 8 * * 1' } },
    conditions: [],
    actions: [{ type: 'notify', params: { userIds: [], message: 'Resumo da semana do time.' } }],
    requires: ['actions.0.params.userIds'],
  },
];
