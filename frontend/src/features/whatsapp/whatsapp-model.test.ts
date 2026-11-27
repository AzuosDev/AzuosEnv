import { describe, expect, it } from 'vitest';
import type { WaBotRule, WaContact, WaConversationItem, WaMessage, WaOverview } from '@/api/types';
import {
  botPauseUntil,
  canSendFreely,
  checkOf,
  contactLabel,
  dayBars,
  durationLabel,
  formatWaNumber,
  groupWaMessagesByDay,
  hoursError,
  isTimeOfDay,
  maxMenuOptions,
  mergeWaMessagePages,
  previewOf,
  quickReplyTerm,
  reactionsOf,
  renderWaPreview,
  resolveWaPeriod,
  resolveWaTab,
  waCapabilities,
  waConnectionLabel,
  usedHoursDays,
  visibleMessages,
  visibleWaTabs,
  waPeriodRange,
  waRuleError,
  waRuleSummary,
  windowOpen,
} from './whatsapp-model';

function contact(extra: Partial<WaContact> = {}): WaContact {
  return {
    id: 'ct1',
    workspaceId: 'w1',
    waId: '5531999990000',
    name: '',
    profileName: 'Ana Cliente',
    tags: [],
    notes: '',
    firstContactAt: null,
    lastInteractionAt: null,
    optOut: false,
    spaceId: null,
    folderId: null,
    createdAt: '2026-01-01T12:00:00.000Z',
    updatedAt: '2026-01-01T12:00:00.000Z',
    ...extra,
  } as WaContact;
}

function message(extra: Partial<WaMessage> = {}): WaMessage {
  return {
    id: 'm1',
    workspaceId: 'w1',
    conversationId: 'cv1',
    waMessageId: 'wamid.1',
    direction: 'inbound',
    type: 'text',
    body: 'Bom dia',
    media: null,
    payload: null,
    replyTo: null,
    status: 'delivered',
    error: null,
    authorId: null,
    fromBot: false,
    sentAt: '2026-03-10T12:00:00.000Z',
    createdAt: '2026-03-10T12:00:00.000Z',
    updatedAt: '2026-03-10T12:00:00.000Z',
    ...extra,
  } as WaMessage;
}

function conversation(extra: Partial<WaConversationItem> = {}): WaConversationItem {
  return {
    id: 'cv1',
    workspaceId: 'w1',
    contactId: 'ct1',
    status: 'open',
    assigneeId: null,
    priority: 'normal',
    mode: 'bot',
    botPausedUntil: null,
    unreadCount: 0,
    lastMessageAt: '2026-03-10T12:00:00.000Z',
    lastInboundAt: '2026-03-10T12:00:00.000Z',
    closedAt: null,
    closedBy: null,
    contact: contact(),
    lastMessage: message(),
    createdAt: '2026-03-10T12:00:00.000Z',
    updatedAt: '2026-03-10T12:00:00.000Z',
    ...extra,
  } as WaConversationItem;
}

describe('abas por nível', () => {
  it('atendente só alcança conversas e contatos', () => {
    expect(visibleWaTabs('atendente').map((tab) => tab.id)).toEqual(['conversas', 'contatos']);
  });

  it('supervisor ganha a visão geral e o gestor ganha tudo', () => {
    expect(visibleWaTabs('supervisor').map((tab) => tab.id)).toEqual([
      'visao-geral',
      'conversas',
      'contatos',
    ]);
    expect(visibleWaTabs('gestor')).toHaveLength(9);
    expect(visibleWaTabs(null)).toEqual([]);
  });

  it('aba fora do nível cai na primeira permitida', () => {
    expect(resolveWaTab('conexao', 'atendente')).toBe('conversas');
    expect(resolveWaTab('conexao', 'gestor')).toBe('conexao');
    expect(resolveWaTab(undefined, 'supervisor')).toBe('conversas');
  });
});

describe('contato', () => {
  it('prefere o nome da equipe, depois o do perfil, depois o número', () => {
    expect(contactLabel(conversation({ contact: contact({ name: 'Ana da Loja' }) }))).toBe(
      'Ana da Loja',
    );
    expect(contactLabel(conversation())).toBe('Ana Cliente');
    expect(contactLabel(conversation({ contact: contact({ profileName: '' }) }))).toBe(
      '+55 31 99999-0000',
    );
  });

  it('formata o número do Brasil com DDD e separa os quatro últimos dígitos', () => {
    expect(formatWaNumber('5531999990000')).toBe('+55 31 99999-0000');
    expect(formatWaNumber('553133334444')).toBe('+55 31 3333-4444');
    expect(formatWaNumber('')).toBe('');
  });
});

describe('prévia da lista', () => {
  it('usa o texto, o tipo ou a legenda da mídia', () => {
    expect(previewOf(message())).toBe('Bom dia');
    expect(previewOf(null)).toBe('Nenhuma mensagem ainda');
    expect(
      previewOf(
        message({
          type: 'image',
          body: '',
          media: {
            mime: 'image/png',
            caption: 'Comprovante',
            filename: 'a.png',
            size: 1,
            mediaId: 'x',
          },
        }),
      ),
    ).toBe('Imagem: Comprovante');
    expect(previewOf(message({ type: 'audio', body: '', media: null }))).toBe('Áudio');
    expect(previewOf(message({ type: 'reaction', body: '👍' }))).toBe('Reagiu 👍');
  });
});

describe('checks de status', () => {
  it('a mensagem recebida não tem check e a enviada segue o status', () => {
    expect(checkOf(message())).toBe('none');
    expect(checkOf(message({ direction: 'outbound', status: 'pending' }))).toBe('none');
    expect(checkOf(message({ direction: 'outbound', status: 'sent' }))).toBe('sent');
    expect(checkOf(message({ direction: 'outbound', status: 'delivered' }))).toBe('delivered');
    expect(checkOf(message({ direction: 'outbound', status: 'read' }))).toBe('read');
    expect(checkOf(message({ direction: 'outbound', status: 'failed' }))).toBe('failed');
  });
});

describe('provedor da conexão', () => {
  it('a Evolution envia livre e não tem template; a Cloud API tem os dois', () => {
    expect(waCapabilities('evolution')).toEqual({
      templates: false,
      window: false,
      qrCode: true,
    });
    expect(waCapabilities('cloud')).toEqual({ templates: true, window: true, qrCode: false });
    // Sem resposta ainda, a tela se molda pelo padrão.
    expect(waCapabilities(null)).toEqual(waCapabilities('evolution'));
  });

  it('só a Cloud API prende o texto livre na janela de 24 h', () => {
    const now = new Date('2026-03-10T12:00:00.000Z');

    expect(canSendFreely('evolution', null, now)).toBe(true);
    expect(canSendFreely('evolution', '2026-03-01T11:00:00.000Z', now)).toBe(true);
    expect(canSendFreely('cloud', '2026-03-10T11:00:00.000Z', now)).toBe(true);
    expect(canSendFreely('cloud', '2026-03-09T11:00:00.000Z', now)).toBe(false);
    expect(canSendFreely('cloud', null, now)).toBe(false);
  });

  it('o selo do cabeçalho diz o estado real', () => {
    expect(waConnectionLabel('connected')).toBe('WhatsApp conectado');
    expect(waConnectionLabel('disconnected')).toBe('WhatsApp desconectado');
    expect(waConnectionLabel('pending')).toBe('WhatsApp pendente');
    expect(waConnectionLabel(null)).toBe('WhatsApp sem conexão');
  });
});

describe('janela de 24 h', () => {
  const now = new Date('2026-03-10T12:00:00.000Z');

  it('abre com mensagem do contato dentro de 24 h e fecha depois', () => {
    expect(windowOpen('2026-03-10T11:00:00.000Z', now)).toBe(true);
    expect(windowOpen('2026-03-09T11:00:00.000Z', now)).toBe(false);
    expect(windowOpen(null, now)).toBe(false);
  });

  it('a pausa do bot só vale no futuro', () => {
    expect(botPauseUntil('2026-03-10T12:30:00.000Z', now)?.toISOString()).toBe(
      '2026-03-10T12:30:00.000Z',
    );
    expect(botPauseUntil('2026-03-10T11:30:00.000Z', now)).toBeNull();
    expect(botPauseUntil(null, now)).toBeNull();
  });
});

describe('mensagens da conversa', () => {
  it('achata as páginas da mais antiga para a mais nova', () => {
    const pages = [
      { items: [message({ id: 'm4' }), message({ id: 'm3' })] },
      { items: [message({ id: 'm2' }), message({ id: 'm1' })] },
    ];

    expect(mergeWaMessagePages(pages).map((item) => item.id)).toEqual(['m1', 'm2', 'm3', 'm4']);
    expect(mergeWaMessagePages(undefined)).toEqual([]);
  });

  it('separa por dia no fuso do navegador', () => {
    const days = groupWaMessagesByDay([
      message({ id: 'm1', sentAt: '2026-03-09T15:00:00.000Z' }),
      message({ id: 'm2', sentAt: '2026-03-10T15:00:00.000Z' }),
      message({ id: 'm3', sentAt: '2026-03-10T16:00:00.000Z' }),
    ]);

    expect(days).toHaveLength(2);
    expect(days[1]?.items.map((item) => item.id)).toEqual(['m2', 'm3']);
  });

  it('a reação sai da lista e vira selo da mensagem citada', () => {
    const items = [
      message({ id: 'm1', waMessageId: 'wamid.1' }),
      message({ id: 'm2', type: 'reaction', body: '👍', replyTo: 'wamid.1' }),
    ];

    expect(visibleMessages(items).map((item) => item.id)).toEqual(['m1']);
    expect(reactionsOf(items).get('wamid.1')).toEqual(['👍']);
  });
});

describe('atalho das respostas rápidas', () => {
  it('só abre com a / começando a mensagem e sem espaço', () => {
    expect(quickReplyTerm('/')).toBe('');
    expect(quickReplyTerm('/horario')).toBe('horario');
    expect(quickReplyTerm('/horario de ')).toBeNull();
    expect(quickReplyTerm('bom dia /horario')).toBeNull();
  });
});

describe('regras do bot', () => {
  const base = {
    name: 'Preço',
    trigger: { kind: 'keyword' as const, value: 'preco' },
    reply: { kind: 'text' as const, text: 'Oi', mediaUrl: '', options: [] as unknown[] },
  };

  it('aceita a regra completa', () => {
    expect(waRuleError(base)).toBeNull();
  });

  it('cobra nome, valor do gatilho e conteúdo da resposta', () => {
    expect(waRuleError({ ...base, name: '  ' })).toBe('A regra precisa de um nome.');
    expect(waRuleError({ ...base, trigger: { kind: 'keyword', value: ' ' } })).toBe(
      'Este gatilho precisa de um valor.',
    );
    expect(waRuleError({ ...base, reply: { ...base.reply, text: ' ' } })).toBe(
      'A resposta de texto precisa de conteúdo.',
    );
  });

  it('não cobra valor de gatilho de momento', () => {
    expect(waRuleError({ ...base, trigger: { kind: 'firstMessage', value: '' } })).toBeNull();
    expect(waRuleError({ ...base, trigger: { kind: 'outsideHours', value: '' } })).toBeNull();
  });

  it('recusa expressão regular inválida', () => {
    expect(waRuleError({ ...base, trigger: { kind: 'regex', value: '(' } })).toBe(
      'A expressão regular da regra não é válida.',
    );
  });

  it('respeita os tetos da Cloud API nas opções', () => {
    const option = { id: 'a', title: 'A' };

    expect(waRuleError({ ...base, reply: { ...base.reply, kind: 'buttons', options: [] } })).toBe(
      'A resposta interativa precisa de pelo menos uma opção.',
    );
    expect(
      waRuleError({
        ...base,
        reply: { ...base.reply, kind: 'buttons', options: [option, option, option, option] },
      }),
    ).toBe('O menu de botões aceita no máximo 3 opções.');
    expect(maxMenuOptions('buttons')).toBe(3);
    expect(maxMenuOptions('list')).toBe(10);
  });

  it('cobra o link da resposta de mídia', () => {
    expect(waRuleError({ ...base, reply: { ...base.reply, kind: 'media' } })).toBe(
      'A resposta de mídia precisa de um link.',
    );
  });

  it('resume a regra do gatilho para a resposta', () => {
    expect(
      waRuleSummary({
        ...({} as WaBotRule),
        trigger: { kind: 'keyword', value: 'preco' },
        reply: {
          kind: 'text',
          text: 'Oi',
          mediaUrl: '',
          mediaMime: '',
          filename: '',
          header: '',
          footer: '',
          buttonLabel: '',
          options: [],
        },
      }),
    ).toBe('Palavra exata: "preco" → Texto');
  });
});

describe('variáveis da prévia', () => {
  it('troca só as variáveis conhecidas', () => {
    expect(renderWaPreview('Oi, {nome}! Seu número é {numero}.')).toBe(
      'Oi, Ana! Seu número é (31) 98888-0001.',
    );
    expect(renderWaPreview('Oi, {outra}')).toBe('Oi, {outra}');
  });
});

describe('horários', () => {
  it('aceita só HH:mm válido', () => {
    expect(isTimeOfDay('09:00')).toBe(true);
    expect(isTimeOfDay('23:59')).toBe(true);
    expect(isTimeOfDay('24:00')).toBe(false);
    expect(isTimeOfDay('9:00')).toBe(false);
  });

  it('aponta o dia da hora errada', () => {
    expect(hoursError([{ weekday: 1, ranges: [{ start: '09:00', end: '18:00' }] }])).toBeNull();
    expect(hoursError([{ weekday: 2, ranges: [{ start: '09:00', end: '99:00' }] }])).toBe(
      'Confira as horas de Terça: use HH:mm entre 00:00 e 23:59.',
    );
  });

  it('manda só os dias com faixa', () => {
    const days = [
      { weekday: 0, ranges: [] },
      { weekday: 1, ranges: [{ start: ' 09:00 ', end: '18:00' }] },
    ];

    expect(usedHoursDays(days)).toEqual([
      { weekday: 1, ranges: [{ start: '09:00', end: '18:00' }] },
    ]);
  });
});

describe('visão geral', () => {
  it('resolve o período da query string', () => {
    expect(resolveWaPeriod('7')).toBe(7);
    expect(resolveWaPeriod('90')).toBe(90);
    expect(resolveWaPeriod(undefined)).toBe(30);
    expect(resolveWaPeriod('365')).toBe(30);
  });

  it('monta a janela do período em UTC', () => {
    const now = new Date('2026-11-19T12:00:00.000Z');

    expect(waPeriodRange(7, now)).toEqual({
      from: '2026-11-12T12:00:00.000Z',
      to: '2026-11-19T12:00:00.000Z',
    });
  });

  it('escreve a duração em pt-BR', () => {
    expect(durationLabel(null)).toBe('—');
    expect(durationLabel(42)).toBe('42 s');
    expect(durationLabel(600)).toBe('10 min');
    expect(durationLabel(3600)).toBe('1 h');
    expect(durationLabel(5400)).toBe('1 h 30 min');
  });

  it('mede as barras pelo maior dia', () => {
    const bars = dayBars({
      newPerDay: [
        { date: '2026-11-17', count: 2 },
        { date: '2026-11-18', count: 4 },
        { date: '2026-11-19', count: 0 },
      ],
    } as WaOverview);

    expect(bars.map((bar) => bar.ratio)).toEqual([0.5, 1, 0]);
  });
});

describe('abas da F20', () => {
  it('libera as cinco abas novas para o gestor', () => {
    const ids = visibleWaTabs('gestor').map((tab) => tab.id);

    expect(ids).toEqual([
      'visao-geral',
      'conversas',
      'contatos',
      'regras',
      'bot',
      'respostas',
      'horarios',
      'conexao',
      'equipe',
    ]);
    expect(visibleWaTabs('gestor').every((tab) => tab.ready)).toBe(true);
  });

  it('não entrega as abas do bot ao supervisor nem ao atendente', () => {
    expect(visibleWaTabs('supervisor').map((tab) => tab.id)).toEqual([
      'visao-geral',
      'conversas',
      'contatos',
    ]);
    expect(visibleWaTabs('atendente').map((tab) => tab.id)).toEqual(['conversas', 'contatos']);
  });
});
