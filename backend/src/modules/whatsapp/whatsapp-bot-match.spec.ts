import { isWithinWaHours, minutesOfDay } from './whatsapp-bot-hours';
import { WaInboundFacts, WaRuleLike, matchWaContextRule, matchWaRule } from './whatsapp-bot-match';
import {
  matchesContains,
  matchesKeyword,
  matchesRegex,
  normalizeWaText,
  renderWaText,
} from './whatsapp-bot-text';
import { WaBotTrigger } from './whatsapp-fields';

function rule(
  kind: WaBotTrigger,
  value: string,
  priority = 0,
  order = '1',
  active = true,
): WaRuleLike {
  return { trigger: { kind, value }, priority, active, order };
}

function facts(partial: Partial<WaInboundFacts> = {}): WaInboundFacts {
  return {
    text: '',
    optionId: null,
    firstMessage: false,
    outsideHours: false,
    ...partial,
  };
}

describe('whatsapp-bot-text', () => {
  it('normaliza acento, caixa e espaço', () => {
    expect(normalizeWaText('  Orçamento   ÚRGENTE ')).toBe('orcamento urgente');
  });

  it('palavra-chave casa a palavra inteira, não o pedaço', () => {
    expect(matchesKeyword('quero um orçamento, por favor', 'orcamento')).toBe(true);
    expect(matchesKeyword('falei com o orçamentista', 'orcamento')).toBe(false);
    expect(matchesKeyword('quero falar com o suporte tecnico', 'suporte técnico')).toBe(true);
    expect(matchesKeyword('qualquer coisa', '')).toBe(false);
  });

  it('contém casa o trecho e regex inválida nunca casa', () => {
    expect(matchesContains('meu pedido atrasou', 'PEDIDO')).toBe(true);
    expect(matchesRegex('nota 12345', '^nota \\d+$')).toBe(true);
    expect(matchesRegex('nota 12345', '([')).toBe(false);
  });

  it('resolve as variáveis conhecidas e deixa o resto como está', () => {
    expect(
      renderWaText('Oi {nome}, o número {numero} e {outro}', { nome: 'Ana', numero: '55' }),
    ).toBe('Oi Ana, o número 55 e {outro}');
  });
});

describe('whatsapp-bot-hours', () => {
  const hours = {
    enabled: true,
    timezone: 'America/Fortaleza',
    days: [{ weekday: 1, ranges: [{ start: '09:00', end: '18:00' }] }],
    holidays: [{ date: '2026-11-16' }],
  };

  it('lê HH:mm e recusa o que não é hora', () => {
    expect(minutesOfDay('09:30')).toBe(570);
    expect(minutesOfDay('25:00')).toBeNull();
    expect(minutesOfDay('nove')).toBeNull();
  });

  it('horário desligado está sempre aberto', () => {
    expect(isWithinWaHours({ ...hours, enabled: false }, new Date(), 'UTC')).toBe(true);
  });

  it('abre dentro da faixa e fecha fora dela, no fuso configurado', () => {
    // Segunda-feira, 23/11/2026: 12:00 e 22:00 em America/Fortaleza (UTC-3).
    expect(isWithinWaHours(hours, new Date('2026-11-23T15:00:00Z'), 'UTC')).toBe(true);
    expect(isWithinWaHours(hours, new Date('2026-11-24T01:00:00Z'), 'UTC')).toBe(false);
  });

  it('domingo sem faixa e feriado ficam fechados', () => {
    expect(isWithinWaHours(hours, new Date('2026-11-22T15:00:00Z'), 'UTC')).toBe(false);
    // 16/11/2026 é uma segunda-feira marcada como feriado.
    expect(isWithinWaHours(hours, new Date('2026-11-16T15:00:00Z'), 'UTC')).toBe(false);
  });

  it('faixa que vira a meia-noite segue aberta até o fim do dia', () => {
    const night = {
      ...hours,
      days: [{ weekday: 1, ranges: [{ start: '22:00', end: '02:00' }] }],
    };

    expect(isWithinWaHours(night, new Date('2026-11-24T02:00:00Z'), 'UTC')).toBe(true);
  });
});

describe('whatsapp-bot-match', () => {
  it('a maior prioridade vence e o empate vai para a regra mais antiga', () => {
    const rules = [
      rule('contains', 'pedido', 1, '2'),
      rule('keyword', 'pedido', 5, '3'),
      rule('keyword', 'pedido', 5, '1'),
    ];

    expect(matchWaRule(rules, facts({ text: 'meu pedido' }))?.order).toBe('1');
  });

  it('regra inativa não dispara', () => {
    const rules = [rule('keyword', 'pedido', 0, '1', false)];

    expect(matchWaRule(rules, facts({ text: 'meu pedido' }))).toBeNull();
  });

  it('opção do menu casa pelo id do botão', () => {
    const rules = [rule('menuOption', 'opt-2')];

    expect(matchWaRule(rules, facts({ optionId: 'opt-2', text: 'Suporte' }))).not.toBeNull();
    expect(matchWaRule(rules, facts({ optionId: 'opt-9' }))).toBeNull();
  });

  it('gatilho de contexto não é escolhido pelo casamento comum', () => {
    const rules = [rule('firstMessage', ''), rule('outsideHours', '')];

    expect(matchWaRule(rules, facts({ firstMessage: true, outsideHours: true }))).toBeNull();
    expect(matchWaContextRule(rules, 'firstMessage', facts({ firstMessage: true }))).not.toBeNull();
    expect(matchWaContextRule(rules, 'firstMessage', facts({ firstMessage: false }))).toBeNull();
    expect(matchWaContextRule(rules, 'outsideHours', facts({ outsideHours: true }))).not.toBeNull();
  });
});
