import { describe, expect, it } from 'vitest';
import type { Automation, AutomationRecipe } from '@/api/types';
import {
  describeAction,
  describeAutomation,
  describeCondition,
  describeTrigger,
  groupByLocation,
  missingRecipeFields,
  recipeDraft,
} from './automation-model';

function automation(partial: Partial<Automation>): Automation {
  return {
    id: 'a1',
    createdAt: '2026-11-10T12:00:00.000Z',
    updatedAt: '2026-11-10T12:00:00.000Z',
    workspaceId: 'ws',
    locationType: 'list',
    locationId: 'l1',
    name: 'Regra',
    active: true,
    trigger: { type: 'taskCreated', params: {} },
    conditions: [],
    actions: [{ type: 'assign', params: { userIds: ['u1'] } }],
    createdBy: 'me',
    ...partial,
  } as Automation;
}

const RECIPE = {
  key: 'reviewerOnStatus',
  name: 'Ao mudar status, atribuir revisor',
  description: '',
  locationTypes: ['space', 'folder', 'list'],
  trigger: { type: 'statusChanged', params: { toStatusId: null } },
  conditions: [],
  actions: [{ type: 'assign', params: { userIds: [] } }],
  requires: ['trigger.params.toStatusId', 'actions.0.params.userIds'],
} as unknown as AutomationRecipe;

describe('describeTrigger', () => {
  it('status com grupo, com id e sem nada', () => {
    expect(describeTrigger({ type: 'statusChanged', params: { toStatusGroup: 'done' } })).toBe(
      'Status muda para concluído',
    );
    expect(describeTrigger({ type: 'statusChanged', params: { toStatusId: 'x' } })).toBe(
      'Status muda para o status escolhido',
    );
    expect(describeTrigger({ type: 'statusChanged', params: {} })).toBe('Status muda');
  });

  it('prazo em dias e em minutos', () => {
    expect(describeTrigger({ type: 'dueDateArrived', params: { beforeMinutes: 1440 } })).toBe(
      'Prazo chega em 1 dia',
    );
    expect(describeTrigger({ type: 'dueDateArrived', params: { beforeMinutes: 30 } })).toBe(
      'Prazo chega em 30 min',
    );
  });

  it('agendamento mostra o cron', () => {
    expect(describeTrigger({ type: 'schedule', params: { cron: '0 8 * * 1' } })).toBe(
      'Em horário agendado (0 8 * * 1)',
    );
  });
});

describe('describeAction', () => {
  it('conta pessoas, nomeia prioridade e mostra a URL', () => {
    expect(describeAction({ type: 'assign', params: { userIds: ['a', 'b'] } })).toBe(
      'Atribuir responsáveis (2)',
    );
    expect(describeAction({ type: 'setPriority', params: { priority: 'urgent' } })).toBe(
      'Mudar prioridade para urgente',
    );
    expect(describeAction({ type: 'callWebhook', params: { url: 'https://exemplo.com/h' } })).toBe(
      'Chamar webhook https://exemplo.com/h',
    );
  });

  it('sem parâmetro fica só o rótulo', () => {
    expect(describeAction({ type: 'assign', params: {} })).toBe('Atribuir responsáveis');
  });
});

describe('describeCondition', () => {
  it('operador unário dispensa valor e lista junta com vírgula', () => {
    expect(describeCondition({ field: 'priority', op: 'isEmpty' })).toBe('priority está vazio');
    expect(describeCondition({ field: 'statusGroup', op: 'nin', value: ['done', 'closed'] })).toBe(
      'statusGroup não está em done, closed',
    );
  });
});

describe('describeAutomation', () => {
  it('junta quando, condições e então', () => {
    const sentence = describeAutomation(
      automation({
        trigger: { type: 'dueDatePassed', params: {} },
        conditions: [{ field: 'statusGroup', op: 'nin', value: ['done'] }],
        actions: [
          { type: 'setPriority', params: { priority: 'urgent' } },
          { type: 'notify', params: { userIds: ['u1'] } },
        ],
      }),
    );

    expect(sentence.when).toBe('Prazo passa');
    expect(sentence.conditions).toEqual(['statusGroup não está em done']);
    expect(sentence.then).toBe('Mudar prioridade para urgente · Notificar pessoas (1)');
  });
});

describe('receitas', () => {
  it('o rascunho copia gatilho, condições e ações', () => {
    const draft = recipeDraft(RECIPE);

    expect(draft.name).toBe(RECIPE.name);
    expect(draft.trigger.type).toBe('statusChanged');
    expect(draft.actions).toHaveLength(1);
  });

  it('aponta o que falta e fica vazio quando tudo foi preenchido', () => {
    const draft = recipeDraft(RECIPE);

    expect(missingRecipeFields(RECIPE, draft.trigger, draft.actions)).toEqual([
      'trigger.params.toStatusId',
      'actions.0.params.userIds',
    ]);

    const ready = missingRecipeFields(
      RECIPE,
      { type: 'statusChanged', params: { toStatusId: 's1' } },
      [{ type: 'assign', params: { userIds: ['u1'] } }],
    );

    expect(ready).toEqual([]);
  });
});

describe('groupByLocation', () => {
  it('uma entrada por local, preservando a ordem', () => {
    const groups = groupByLocation([
      automation({ id: '1', locationType: 'list', locationId: 'l1' }),
      automation({ id: '2', locationType: 'space', locationId: 's1' }),
      automation({ id: '3', locationType: 'list', locationId: 'l1' }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.items.map((item) => item.id)).toEqual(['1', '3']);
    expect(groups[1]).toMatchObject({ locationType: 'space', locationId: 's1' });
  });
});
