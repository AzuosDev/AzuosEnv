import { describe, expect, it } from 'vitest';
import { citedTasks, parseSse } from './ai-events';

describe('parseSse', () => {
  it('entrega os eventos completos e guarda o resto', () => {
    const first = parseSse('data: {"type":"start","conversationId":"c1"}\n\ndata: {"type":"del');

    expect(first.events).toEqual([{ type: 'start', conversationId: 'c1' }]);
    expect(first.rest).toBe('data: {"type":"del');

    const second = parseSse(`${first.rest}ta","text":"oi"}\n\n`);

    expect(second.events).toEqual([{ type: 'delta', text: 'oi' }]);
    expect(second.rest).toBe('');
  });

  it('ignora bloco sem data e tipo desconhecido', () => {
    const { events } = parseSse(': ping\n\ndata: {"type":"outro"}\n\ndata: nao-json\n\n');

    expect(events).toEqual([]);
  });
});

describe('citedTasks', () => {
  it('junta as tarefas das ferramentas sem repetir', () => {
    const chips = citedTasks([
      { items: [{ id: '1', customId: 'AZ-1', name: 'Corrigir caixa' }] },
      { task: { id: '1', customId: 'AZ-1', name: 'Corrigir caixa' } },
      { tasks: [{ id: '2', customId: 'AZ-2' }] },
      { total: 3 },
    ]);

    expect(chips).toEqual([
      { id: '1', customId: 'AZ-1', name: 'Corrigir caixa' },
      { id: '2', customId: 'AZ-2', name: 'AZ-2' },
    ]);
  });
});
