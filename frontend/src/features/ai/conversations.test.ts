import { describe, expect, it } from 'vitest';
import { titleFrom, upsertConversation, type AiConversation } from './conversations';

const conversation = (id: string, title = id): AiConversation => ({
  id,
  title,
  updatedAt: '2026-01-01T00:00:00.000Z',
  messages: [],
});

describe('titleFrom', () => {
  it('usa a pergunta e corta o que passa do limite', () => {
    expect(titleFrom('  Quais tarefas  estão atrasadas? ')).toBe('Quais tarefas estão atrasadas?');
    expect(titleFrom('a'.repeat(60))).toBe(`${'a'.repeat(45)}...`);
    expect(titleFrom('   ')).toBe('Conversa sem título');
  });
});

describe('upsertConversation', () => {
  it('põe no topo e não duplica', () => {
    const list = [conversation('c1'), conversation('c2')];
    const next = upsertConversation(list, { ...conversation('c2'), title: 'Nova' });

    expect(next.map((item) => item.id)).toEqual(['c2', 'c1']);
    expect(next[0]?.title).toBe('Nova');
  });

  it('descarta o rascunho e guarda no máximo 20', () => {
    const many = Array.from({ length: 25 }, (_, index) => conversation(`c${String(index)}`));
    const next = upsertConversation([conversation('draft'), ...many], conversation('novo'));

    expect(next).toHaveLength(20);
    expect(next.some((item) => item.id === 'draft')).toBe(false);
  });
});
