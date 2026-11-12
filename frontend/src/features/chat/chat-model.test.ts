import { describe, expect, it } from 'vitest';
import type { Channel, ChatActivity, Message, WorkspaceMemberItem } from '@/api/types';
import {
  appendReply,
  canDeleteMessage,
  channelTitle,
  groupMessages,
  mergeMessagePages,
  messagePreview,
  messageReactions,
  prependMessage,
  removeMessage,
  replaceMessage,
  sortByLastMessage,
  splitChannels,
  typingLabel,
  unreadOf,
} from './chat-model';

function message(id: string, extra: Partial<Message> = {}): Message {
  return {
    id,
    workspaceId: 'w1',
    channelId: 'c1',
    authorId: 'u1',
    body: null,
    bodyText: id,
    parentMessageId: null,
    replyCount: 0,
    lastReplyAt: null,
    mentions: [],
    reactions: [],
    attachmentIds: [],
    editedAt: null,
    deletedAt: null,
    createdAt: '2026-03-02T10:00:00.000Z',
    updatedAt: '2026-03-02T10:00:00.000Z',
    ...extra,
  } as Message;
}

function channel(id: string, extra: Partial<Channel> = {}): Channel {
  return {
    id,
    workspaceId: 'w1',
    type: 'channel',
    name: id,
    locationType: 'workspace',
    locationId: null,
    private: false,
    memberIds: [],
    createdBy: 'u1',
    archivedAt: null,
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:00:00.000Z',
    ...extra,
  } as Channel;
}

function member(id: string, name: string): WorkspaceMemberItem {
  return { userId: { id, name, email: `${id}@azuos.dev` } } as WorkspaceMemberItem;
}

describe('mergeMessagePages', () => {
  it('devolve as mensagens da mais antiga para a mais nova', () => {
    const pages = [
      { items: [message('m4'), message('m3')] },
      { items: [message('m2'), message('m1')] },
    ];

    expect(mergeMessagePages(pages).map((item) => item.id)).toEqual(['m1', 'm2', 'm3', 'm4']);
  });

  it('aceita cache vazio', () => {
    expect(mergeMessagePages(undefined)).toEqual([]);
  });
});

describe('groupMessages', () => {
  it('junta mensagens seguidas do mesmo autor e separa por dia', () => {
    const days = groupMessages([
      message('a', { createdAt: '2026-03-02T10:00:00.000Z' }),
      message('b', { createdAt: '2026-03-02T10:02:00.000Z' }),
      message('c', { authorId: 'u2', createdAt: '2026-03-02T10:03:00.000Z' }),
      message('d', { createdAt: '2026-03-03T09:00:00.000Z' }),
    ]);

    expect(days).toHaveLength(2);
    expect(days[0]?.blocks.map((block) => block.items.map((item) => item.id))).toEqual([
      ['a', 'b'],
      ['c'],
    ]);
    expect(days[1]?.blocks).toHaveLength(1);
  });

  it('abre bloco novo quando passa da janela de agrupamento', () => {
    const days = groupMessages([
      message('a', { createdAt: '2026-03-02T10:00:00.000Z' }),
      message('b', { createdAt: '2026-03-02T10:40:00.000Z' }),
    ]);

    expect(days[0]?.blocks).toHaveLength(2);
  });
});

describe('cache das mensagens', () => {
  it('prepend põe a mensagem na página mais nova e ignora repetida', () => {
    const pages = [{ items: [message('m2')] }, { items: [message('m1')] }];
    const next = prependMessage(pages, message('m3'));

    expect(next[0]?.items.map((item) => item.id)).toEqual(['m3', 'm2']);
    expect(prependMessage(next, message('m3'))).toBe(next);
  });

  it('appendReply põe a resposta no fim da última página', () => {
    const pages = [{ items: [message('r1')] }, { items: [message('r2')] }];

    expect(appendReply(pages, message('r3'))[1]?.items.map((item) => item.id)).toEqual([
      'r2',
      'r3',
    ]);
  });

  it('replace e remove mexem em qualquer página', () => {
    const pages = [{ items: [message('m2')] }, { items: [message('m1')] }];
    const edited = replaceMessage(pages, message('m1', { bodyText: 'novo' }));

    expect(edited[1]?.items[0]?.bodyText).toBe('novo');
    expect(removeMessage(pages, 'm2')[0]?.items).toEqual([]);
  });
});

describe('reações e permissão', () => {
  it('marca a reação do próprio usuário e esconde a vazia', () => {
    const states = messageReactions(
      message('m1', {
        reactions: [
          { emoji: '👍', userIds: ['u1', 'u2'] },
          { emoji: '🎉', userIds: [] },
        ],
      }),
      'u2',
    );

    expect(states).toEqual([{ emoji: '👍', count: 2, mine: true }]);
  });

  it('excluir é do autor, do owner e do admin', () => {
    const mine = message('m1', { authorId: 'u1' });

    expect(canDeleteMessage(mine, 'u1', 'member')).toBe(true);
    expect(canDeleteMessage(mine, 'u2', 'member')).toBe(false);
    expect(canDeleteMessage(mine, 'u2', 'admin')).toBe(true);
  });
});

describe('canais', () => {
  it('a DM é nomeada pela outra pessoa', () => {
    const dm = channel('c2', { type: 'dm', name: '', memberIds: ['u1', 'u2'] });

    expect(channelTitle(dm, [member('u2', 'Ezequiel Santos')], 'u1')).toBe('Ezequiel Santos');
    expect(channelTitle(channel('geral'), [], 'u1')).toBe('geral');
  });

  it('separa canais de conversas diretas', () => {
    const groups = splitChannels([
      channel('geral'),
      channel('c2', { type: 'dm' }),
      channel('c3', { type: 'group' }),
    ]);

    expect(groups.channels.map((one) => one.id)).toEqual(['geral', 'c3']);
    expect(groups.dms.map((one) => one.id)).toEqual(['c2']);
  });

  it('ordena pela mensagem mais recente e conta as não lidas', () => {
    const activity: ChatActivity = {
      unread: 3,
      items: [
        {
          channelId: 'a',
          type: 'channel',
          name: 'a',
          unread: 1,
          lastMessageAt: '2026-03-01T10:00:00.000Z',
          lastReadAt: null,
        },
        {
          channelId: 'b',
          type: 'channel',
          name: 'b',
          unread: 2,
          lastMessageAt: '2026-03-04T10:00:00.000Z',
          lastReadAt: null,
        },
      ],
    };

    expect(sortByLastMessage([channel('a'), channel('b')], activity).map((one) => one.id)).toEqual([
      'b',
      'a',
    ]);
    expect(unreadOf(activity, 'b')).toBe(2);
    expect(unreadOf(activity, 'c')).toBe(0);
  });
});

describe('typingLabel e messagePreview', () => {
  it('monta a frase por quantidade de pessoas', () => {
    expect(typingLabel([])).toBe('');
    expect(typingLabel(['Ana'])).toBe('Ana está digitando…');
    expect(typingLabel(['Ana', 'Bruno'])).toBe('Ana e Bruno estão digitando…');
    expect(typingLabel(['Ana', 'Bruno', 'Caio'])).toBe('Várias pessoas estão digitando…');
  });

  it('corta a prévia no tamanho pedido', () => {
    expect(messagePreview(message('m1', { bodyText: 'oi   tudo\nbem' }))).toBe('oi tudo bem');
    expect(messagePreview(message('m1', { bodyText: 'abcdef' }), 4)).toBe('abc…');
  });
});
