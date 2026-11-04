import { dmMemberIds, isOpenChannel } from './chat-rules';

describe('chat-rules', () => {
  describe('dmMemberIds', () => {
    it('ordena o par sempre do mesmo jeito', () => {
      const a = '507f1f77bcf86cd799439011';
      const b = '507f1f77bcf86cd799439012';

      expect(dmMemberIds(a, b).map(String)).toEqual(dmMemberIds(b, a).map(String));
    });

    it('recusa a conversa consigo mesmo', () => {
      const a = '507f1f77bcf86cd799439011';

      expect(() => dmMemberIds(a, a)).toThrow();
    });
  });

  describe('isOpenChannel', () => {
    it('só o canal público aceita qualquer membro do workspace', () => {
      expect(isOpenChannel({ type: 'channel', private: false })).toBe(true);
      expect(isOpenChannel({ type: 'channel', private: true })).toBe(false);
      expect(isOpenChannel({ type: 'group', private: false })).toBe(false);
      expect(isOpenChannel({ type: 'dm', private: true })).toBe(false);
    });
  });
});
