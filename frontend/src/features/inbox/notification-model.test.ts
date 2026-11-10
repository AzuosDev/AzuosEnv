import { describe, expect, it } from 'vitest';
import type { Notification } from '@/api/types';
import {
  describeNotification,
  isUnread,
  mergeNotificationPages,
  snoozeChoices,
  titleWithBadge,
} from './notification-model';

function entry(patch: Partial<Notification> = {}): Notification {
  return {
    id: 'n1',
    createdAt: '2026-03-02T12:00:00.000Z',
    updatedAt: '2026-03-02T12:00:00.000Z',
    workspaceId: 'w1',
    userId: 'u1',
    type: 'assigned',
    entityType: 'task',
    entityId: 't1',
    actorId: 'u2',
    data: { taskId: 't1', customId: 'AZD-142', name: 'Subir o PDV', listId: 'l1' },
    bucket: 'primary',
    readAt: null,
    snoozedUntil: null,
    clearedAt: null,
    ...patch,
  } as Notification;
}

describe('describeNotification', () => {
  it('monta a frase e a tarefa a partir do data', () => {
    const card = describeNotification(entry());

    expect(card.verb).toBe('atribuiu você a');
    expect(card.task).toEqual({
      customId: 'AZD-142',
      name: 'Subir o PDV',
      label: 'AZD-142 Subir o PDV',
    });
    expect(card.system).toBe(false);
    expect(card.targetFirst).toBe(false);
  });

  it('trata entrada do sistema como sem ator e põe a tarefa na frente', () => {
    const card = describeNotification(entry({ type: 'overdue', actorId: null }));

    expect(card.system).toBe(true);
    expect(card.targetFirst).toBe(true);
    expect(card.verb).toBe('passou do prazo');
  });

  it('mantém o sujeito na frente quando o tipo pede ator, mesmo sem ator', () => {
    const card = describeNotification(entry({ actorId: null }));

    expect(card.system).toBe(true);
    expect(card.targetFirst).toBe(false);
  });

  it('não repete o id quando o nome da tarefa não veio', () => {
    const card = describeNotification(entry({ data: { customId: 'AZD-142' } }));

    expect(card.task?.label).toBe('AZD-142');
  });

  it('não inventa tarefa quando o data não traz customId', () => {
    const card = describeNotification(
      entry({ type: 'invited', entityType: 'workspace', data: { workspaceName: 'Azuos Dev' } }),
    );

    expect(card.task).toBeNull();
    expect(card.detail).toBe('Azuos Dev');
  });
});

describe('snoozeChoices', () => {
  it('oferece uma hora, amanhã às 9h e a próxima semana', () => {
    const now = new Date('2026-03-02T15:30:00.000Z');
    const choices = snoozeChoices(now);

    expect(choices.map((choice) => choice.key)).toEqual(['hour', 'tomorrow', 'week']);
    expect(new Date(choices[0]?.until ?? '').getTime() - now.getTime()).toBe(3_600_000);
    expect(new Date(choices[1]?.until ?? '').getHours()).toBe(9);
    expect(new Date(choices[2]?.until ?? '').getDate()).toBe(9);
  });
});

describe('mergeNotificationPages', () => {
  it('junta as páginas na ordem em que chegaram', () => {
    const merged = mergeNotificationPages([
      { items: [entry({ id: 'a' })] },
      { items: [entry({ id: 'b' })] },
    ]);

    expect(merged.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('devolve lista vazia sem páginas', () => {
    expect(mergeNotificationPages(undefined)).toEqual([]);
  });
});

describe('isUnread e titleWithBadge', () => {
  it('lida pelo readAt', () => {
    expect(isUnread(entry())).toBe(true);
    expect(isUnread(entry({ readAt: '2026-03-02T13:00:00.000Z' }))).toBe(false);
  });

  it('põe o contador no título só quando há não lida', () => {
    expect(titleWithBadge('Azuos Env', 0)).toBe('Azuos Env');
    expect(titleWithBadge('Azuos Env', 3)).toBe('(3) Azuos Env');
  });
});
