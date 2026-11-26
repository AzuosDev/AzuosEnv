import { describe, expect, it } from 'vitest';
import type { ChatActivity } from '@/api/types';
import {
  activityTitle,
  withNewMessage,
  type ChannelActivityEvent,
} from './hooks/use-chat-activity';

const event: ChannelActivityEvent = {
  workspaceId: 'w1',
  channelId: 'c1',
  channelName: 'geral',
  channelType: 'channel',
  messageId: 'm1',
  parentMessageId: null,
  authorId: 'u2',
  mentions: [],
  preview: 'subi o build',
};

const at = '2026-11-26T19:00:00.000Z';

function activity(unread: number): ChatActivity {
  return {
    items: [
      {
        channelId: 'c1',
        type: 'channel',
        name: 'geral',
        unread,
        lastMessageAt: null,
        lastReadAt: null,
      },
    ],
    unread,
  };
}

describe('withNewMessage', () => {
  it('soma uma não lida no canal e no total', () => {
    const next = withNewMessage(activity(2), event, at);

    expect(next?.items[0]).toMatchObject({ unread: 3, lastMessageAt: at });
    expect(next?.unread).toBe(3);
  });

  it('canal que ainda não estava no resumo entra com uma não lida', () => {
    const next = withNewMessage(
      activity(0),
      { ...event, channelId: 'c2', channelName: 'avisos' },
      at,
    );

    expect(next?.items).toHaveLength(2);
    expect(next?.items[1]).toMatchObject({ channelId: 'c2', name: 'avisos', unread: 1 });
    expect(next?.unread).toBe(1);
  });

  it('sem resumo em cache nada é inventado: a consulta busca do servidor', () => {
    expect(withNewMessage(undefined, event, at)).toBeUndefined();
  });
});

describe('activityTitle', () => {
  it('cita quem escreveu quando o nome está no cache', () => {
    expect(activityTitle('Felipe Souza', 'geral')).toBe('Nova mensagem de Felipe Souza');
  });

  it('sem o nome, cita o canal', () => {
    expect(activityTitle(undefined, 'geral')).toBe('Nova mensagem em geral');
    expect(activityTitle('', 'geral')).toBe('Nova mensagem em geral');
  });
});
