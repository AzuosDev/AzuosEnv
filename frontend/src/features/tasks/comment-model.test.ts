import { describe, expect, it } from 'vitest';
import type { Comment, CommentThread } from '@/api/types';
import {
  appendComment,
  canDeleteComment,
  countComments,
  isAuthor,
  mergeThreadPages,
  reactionStates,
  removeComment,
  replaceComment,
} from './comment-model';

function comment(id: string, extra: Partial<Comment> = {}): Comment {
  return {
    id,
    workspaceId: 'w1',
    entityType: 'task',
    entityId: 't1',
    parentCommentId: null,
    body: null,
    bodyText: id,
    anchor: null,
    mentions: [],
    assigneeId: null,
    resolvedAt: null,
    resolvedBy: null,
    reactions: [],
    editedAt: null,
    createdBy: 'u1',
    deletedAt: null,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
    ...extra,
  } as Comment;
}

function thread(id: string, replies: Comment[] = []): CommentThread {
  return { comment: comment(id), replies };
}

describe('mergeThreadPages', () => {
  it('junta as páginas e mostra a thread mais nova primeiro', () => {
    const pages = [{ items: [thread('c1'), thread('c2')] }, { items: [thread('c3')] }];

    expect(mergeThreadPages(pages).map((item) => item.comment.id)).toEqual(['c3', 'c2', 'c1']);
  });

  it('aceita o cache ainda vazio', () => {
    expect(mergeThreadPages(undefined)).toEqual([]);
  });
});

describe('reactionStates', () => {
  it('conta cada emoji e marca a reação do próprio usuário', () => {
    const item = comment('c1', {
      reactions: [
        { emoji: '👍', userIds: ['u1', 'u2'] },
        { emoji: '🎉', userIds: ['u2'] },
      ],
    } as Partial<Comment>);

    expect(reactionStates(item, 'u1')).toEqual([
      { emoji: '👍', count: 2, mine: true },
      { emoji: '🎉', count: 1, mine: false },
    ]);
  });

  it('descarta emoji sem ninguém', () => {
    const item = comment('c1', { reactions: [{ emoji: '👍', userIds: [] }] } as Partial<Comment>);

    expect(reactionStates(item, 'u1')).toEqual([]);
  });
});

describe('autoria', () => {
  it('reconhece o autor', () => {
    expect(isAuthor(comment('c1', { createdBy: 'u9' }), 'u9')).toBe(true);
    expect(isAuthor(comment('c1', { createdBy: 'u9' }), 'u1')).toBe(false);
    expect(isAuthor(comment('c1'), undefined)).toBe(false);
  });

  it('deixa o autor e quem administra excluir', () => {
    const other = comment('c1', { createdBy: 'u9' });

    expect(canDeleteComment(other, 'u9', 'member')).toBe(true);
    expect(canDeleteComment(other, 'u1', 'admin')).toBe(true);
    expect(canDeleteComment(other, 'u1', 'owner')).toBe(true);
    expect(canDeleteComment(other, 'u1', 'member')).toBe(false);
  });
});

describe('replaceComment', () => {
  it('troca a raiz da thread', () => {
    const threads = [thread('c1'), thread('c2')];
    const edited = comment('c2', { bodyText: 'novo' });

    expect(replaceComment(threads, edited)[1]?.comment.bodyText).toBe('novo');
  });

  it('troca uma resposta sem mexer no resto', () => {
    const threads = [thread('c1', [comment('r1'), comment('r2')])];
    const edited = comment('r2', { bodyText: 'novo' });
    const result = replaceComment(threads, edited);

    expect(result[0]?.replies.map((reply) => reply.bodyText)).toEqual(['r1', 'novo']);
  });
});

describe('removeComment', () => {
  it('tira a thread inteira quando a raiz sai', () => {
    const threads = [thread('c1', [comment('r1')]), thread('c2')];

    expect(removeComment(threads, 'c1').map((item) => item.comment.id)).toEqual(['c2']);
  });

  it('tira só a resposta', () => {
    const threads = [thread('c1', [comment('r1'), comment('r2')])];

    expect(removeComment(threads, 'r1')[0]?.replies.map((reply) => reply.id)).toEqual(['r2']);
  });
});

describe('appendComment', () => {
  it('põe a raiz nova no fim, como a API devolveria', () => {
    const threads = [thread('c1')];
    const result = appendComment(threads, comment('c2'));

    expect(result.map((item) => item.comment.id)).toEqual(['c1', 'c2']);
    expect(result[1]?.replies).toEqual([]);
  });

  it('põe a resposta no fim da thread do pai', () => {
    const threads = [thread('c1', [comment('r1')]), thread('c2')];
    const result = appendComment(threads, comment('r2', { parentCommentId: 'c1' }));

    expect(result[0]?.replies.map((reply) => reply.id)).toEqual(['r1', 'r2']);
    expect(result[1]?.replies).toEqual([]);
  });
});

describe('countComments', () => {
  it('soma raízes e respostas', () => {
    expect(countComments([thread('c1', [comment('r1'), comment('r2')]), thread('c2')])).toBe(4);
  });
});
