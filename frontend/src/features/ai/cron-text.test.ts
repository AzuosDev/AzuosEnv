import { describe, expect, it } from 'vitest';
import { cronToText } from './cron-text';

describe('cronToText', () => {
  it('lê os padrões do app', () => {
    expect(cronToText('0 8 * * *')).toBe('Todo dia às 8 h');
    expect(cronToText('30 7 * * *')).toBe('Todo dia às 7h30');
    expect(cronToText('0 8 * * 1-5')).toBe('De segunda a sexta às 8 h');
    expect(cronToText('0 9 * * 1')).toBe('Toda segunda às 9 h');
    expect(cronToText('0 8 1 * *')).toBe('Todo dia 1 do mês às 8 h');
    expect(cronToText('0 * * * *')).toBe('A cada hora');
  });

  it('devolve a expressão quando não reconhece', () => {
    expect(cronToText('*/5 * * * *')).toBe('*/5 * * * *');
    expect(cronToText('0 8 * *')).toBe('0 8 * *');
  });
});
