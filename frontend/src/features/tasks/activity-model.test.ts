import { describe, expect, it } from 'vitest';
import type { Activity, Comment, CommentThread } from '@/api/types';
import {
  activityFieldLabel,
  activityLines,
  describeActivity,
  formatActivityValue,
  mergeFeed,
} from './activity-model';

function activity(extra: Partial<Activity> = {}): Activity {
  return {
    id: 'a1',
    workspaceId: 'w1',
    entityType: 'task',
    entityId: 't1',
    action: 'updated',
    actorId: 'u1',
    changes: [],
    taskId: 't1',
    listId: 'l1',
    createdAt: '2026-01-02T10:00:00.000Z',
    updatedAt: '2026-01-02T10:00:00.000Z',
    ...extra,
  } as Activity;
}

const names: Record<string, string> = { s1: 'Em andamento', u2: 'Ana', l2: 'Sprint 2' };
const resolve = (id: string): string | undefined => names[id];

describe('formatActivityValue', () => {
  it('chama o vazio de vazio', () => {
    expect(formatActivityValue('name', null)).toBe('vazio');
    expect(formatActivityValue('assigneeIds', [])).toBe('vazio');
  });

  it('resolve id de status e de pessoa pelo nome', () => {
    expect(formatActivityValue('statusId', 's1', resolve)).toBe('Em andamento');
    expect(formatActivityValue('assigneeIds', ['u2'], resolve)).toBe('Ana');
  });

  it('traduz prioridade, tipo e booleano', () => {
    expect(formatActivityValue('priority', 'urgent')).toBe('Urgente');
    expect(formatActivityValue('type', 'bug')).toBe('Bug');
    expect(formatActivityValue('dueHasTime', true)).toBe('sim');
  });

  it('formata minutos de estimativa e data em pt-BR', () => {
    expect(formatActivityValue('estimateMinutes', 90)).toBe('1h 30min');
    expect(formatActivityValue('dueAt', '2026-03-04T15:00:00.000Z')).toContain('de mar');
  });

  it('não despeja o documento do editor na tela', () => {
    expect(formatActivityValue('description', { type: 'doc' })).toBe('(conteúdo)');
  });
});

describe('activityLines', () => {
  it('traduz cada mudança em rótulo e valores', () => {
    const entry = activity({
      changes: [{ field: 'statusId', from: null, to: 's1' }],
    });

    expect(activityLines(entry, resolve)).toEqual([
      { field: 'statusId', label: 'status', from: 'vazio', to: 'Em andamento' },
    ]);
  });

  it('usa o nome cru do campo quando não há rótulo', () => {
    expect(activityFieldLabel('campoNovo')).toBe('campoNovo');
  });
});

describe('describeActivity', () => {
  it('descreve criação, comentário e lixeira', () => {
    expect(describeActivity(activity({ action: 'created' }))).toBe('criou a tarefa');
    expect(describeActivity(activity({ action: 'created', entityType: 'comment' }))).toBe(
      'comentou na tarefa',
    );
    expect(describeActivity(activity({ action: 'deleted' }))).toBe(
      'mandou a tarefa para a lixeira',
    );
  });

  it('descreve resolução de comentário', () => {
    expect(describeActivity(activity({ action: 'resolved', entityType: 'comment' }))).toBe(
      'resolveu um comentário',
    );
  });

  it('diz para onde a tarefa foi no move', () => {
    const entry = activity({
      action: 'moved',
      changes: [{ field: 'listId', from: 'l1', to: 'l2' }],
    });

    expect(describeActivity(entry, resolve)).toBe('moveu a tarefa para Sprint 2');
  });

  it('lista os campos alterados', () => {
    const entry = activity({
      changes: [
        { field: 'name', from: 'a', to: 'b' },
        { field: 'priority', from: null, to: 'high' },
        { field: 'dueAt', from: null, to: '2026-03-04T15:00:00.000Z' },
      ],
    });

    expect(describeActivity(entry)).toBe('alterou nome, prioridade e prazo');
  });

  it('sem mudança registrada, fala genérico', () => {
    expect(describeActivity(activity())).toBe('atualizou a tarefa');
  });
});

describe('mergeFeed', () => {
  function thread(id: string, at: string): CommentThread {
    return {
      comment: { id, createdAt: at, bodyText: id } as Comment,
      replies: [],
    };
  }

  it('intercala comentários e histórico do mais novo para o mais antigo', () => {
    const feed = mergeFeed(
      [thread('c1', '2026-01-03T10:00:00.000Z'), thread('c2', '2026-01-01T10:00:00.000Z')],
      [activity({ id: 'a1', createdAt: '2026-01-02T10:00:00.000Z' })],
    );

    expect(
      feed.map((entry) => (entry.kind === 'comment' ? entry.thread.comment.id : entry.activity.id)),
    ).toEqual(['c1', 'a1', 'c2']);
  });

  it('descarta a linha "comentou", que o próprio comentário já mostra', () => {
    const feed = mergeFeed(
      [thread('c1', '2026-01-03T10:00:00.000Z')],
      [activity({ id: 'a1', entityType: 'comment', action: 'created' })],
    );

    expect(feed).toHaveLength(1);
    expect(feed[0]?.kind).toBe('comment');
  });
});
