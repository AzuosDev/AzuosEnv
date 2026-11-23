import { describe, expect, it } from 'vitest';
import { queryKeys } from '@/api/keys';
import { isChatPollKey } from './use-chat-realtime';

const WS = 'ws1';

describe('isChatPollKey', () => {
  it('casa as mensagens do canal e as respostas da thread do workspace', () => {
    expect(isChatPollKey(queryKeys.messages(WS, 'c1'), WS)).toBe(true);
    expect(isChatPollKey(queryKeys.messageReplies(WS, 'm1'), WS)).toBe(true);
  });

  it('ignora outro workspace e outras queries do canal', () => {
    expect(isChatPollKey(queryKeys.messages('outro', 'c1'), WS)).toBe(false);
    expect(isChatPollKey(queryKeys.channel(WS, 'c1'), WS)).toBe(false);
    expect(isChatPollKey(queryKeys.channelReads(WS, 'c1'), WS)).toBe(false);
    expect(isChatPollKey(queryKeys.channelAttachments(WS, 'c1'), WS)).toBe(false);
    expect(isChatPollKey(queryKeys.tasks(WS, {}), WS)).toBe(false);
  });
});
