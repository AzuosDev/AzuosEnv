import { describe, expect, it } from 'vitest';
import type { WaContact, WaConversationItem, WaMessage } from '@/api/types';
import {
  botPauseUntil,
  checkOf,
  contactLabel,
  formatWaNumber,
  groupWaMessagesByDay,
  mergeWaMessagePages,
  previewOf,
  quickReplyTerm,
  reactionsOf,
  resolveWaTab,
  visibleMessages,
  visibleWaTabs,
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
