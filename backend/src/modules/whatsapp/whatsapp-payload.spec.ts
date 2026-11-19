import { hasWaLevelAtLeast, isStatusAhead, isWindowOpen } from './whatsapp-fields';
import { readChanges, readPhoneNumberId } from './whatsapp-payload';

function envelope(value: Record<string, unknown>): Record<string, unknown> {
  return { object: 'whatsapp_business_account', entry: [{ changes: [{ value }] }] };
}

function withMetadata(value: Record<string, unknown>): Record<string, unknown> {
  return { messaging_product: 'whatsapp', metadata: { phone_number_id: '55501' }, ...value };
}

describe('whatsapp-payload', () => {
  it('lê o phone_number_id que roteia o webhook', () => {
    expect(readPhoneNumberId(envelope(withMetadata({})))).toBe('55501');
    expect(readPhoneNumberId({})).toBeNull();
    expect(readPhoneNumberId(envelope({ messages: [] }))).toBeNull();
  });

  it('achata contato e mensagem de texto citada', () => {
    const [change] = readChanges(
      envelope(
        withMetadata({
          contacts: [{ wa_id: '5531999', profile: { name: 'Ana' } }],
          messages: [
            {
              id: 'wamid.1',
              from: '5531999',
              timestamp: '1700000000',
              type: 'text',
              text: { body: 'Olá' },
              context: { id: 'wamid.0' },
            },
          ],
        }),
      ),
    );

    expect(change.contacts).toEqual([{ waId: '5531999', profileName: 'Ana' }]);
    expect(change.messages[0]).toMatchObject({
      waMessageId: 'wamid.1',
      from: '5531999',
      type: 'text',
      body: 'Olá',
      replyTo: 'wamid.0',
      mediaId: null,
    });
    expect(change.messages[0].sentAt.toISOString()).toBe('2023-11-14T22:13:20.000Z');
  });

  it('achata cada tipo de conteúdo recebido', () => {
    const [change] = readChanges(
      envelope(
        withMetadata({
          messages: [
            {
              id: 'm1',
              from: '1',
              type: 'image',
              image: { id: 'media-1', mime_type: 'image/jpeg', caption: 'Nota' },
            },
            {
              id: 'm2',
              from: '1',
              type: 'document',
              document: { id: 'media-2', mime_type: 'application/pdf', filename: 'nf.pdf' },
            },
            {
              id: 'm3',
              from: '1',
              type: 'location',
              location: { latitude: -19.9, longitude: -43.9, name: 'Azuos' },
            },
            {
              id: 'm4',
              from: '1',
              type: 'contacts',
              contacts: [{ name: { formatted_name: 'João' }, phones: [{ phone: '+55 31' }] }],
            },
            {
              id: 'm5',
              from: '1',
              type: 'interactive',
              interactive: { type: 'button_reply', button_reply: { id: 'sim', title: 'Sim' } },
            },
            {
              id: 'm6',
              from: '1',
              type: 'reaction',
              reaction: { emoji: '👍', message_id: 'm1' },
            },
            { id: 'm7', from: '1', type: 'order', order: {} },
          ],
        }),
      ),
    );

    expect(change.messages.map((message) => message.type)).toEqual([
      'image',
      'document',
      'location',
      'contacts',
      'interactive',
      'reaction',
      'unsupported',
    ]);
    expect(change.messages[0]).toMatchObject({ mediaId: 'media-1', caption: 'Nota' });
    expect(change.messages[1]).toMatchObject({ filename: 'nf.pdf', body: 'nf.pdf' });
    expect(change.messages[2].payload).toMatchObject({ latitude: -19.9, name: 'Azuos' });
    expect(change.messages[3].body).toBe('João');
    expect(change.messages[4].payload).toMatchObject({ id: 'sim', title: 'Sim' });
    expect(change.messages[5].payload).toMatchObject({ emoji: '👍', messageId: 'm1' });
  });

  it('descarta mensagem sem id e status desconhecido', () => {
    const [change] = readChanges(
      envelope(
        withMetadata({
          messages: [{ from: '1', type: 'text', text: { body: 'x' } }],
          statuses: [
            { id: 'm1', status: 'delivered', timestamp: '1700000000' },
            { id: 'm2', status: 'inventado' },
            { status: 'read' },
          ],
        }),
      ),
    );

    expect(change.messages).toHaveLength(0);
    expect(change.statuses).toHaveLength(1);
    expect(change.statuses[0]).toMatchObject({ waMessageId: 'm1', status: 'delivered' });
  });

  it('lê o erro de um status failed', () => {
    const [change] = readChanges(
      envelope(
        withMetadata({
          statuses: [
            {
              id: 'm1',
              status: 'failed',
              errors: [{ code: '131047', title: 'Re-engagement', message: 'Fora da janela' }],
            },
          ],
        }),
      ),
    );

    expect(change.statuses[0].error).toEqual({
      code: '131047',
      title: 'Re-engagement',
      message: 'Fora da janela',
    });
  });
});

describe('whatsapp-fields', () => {
  it('ordena os níveis de acesso', () => {
    expect(hasWaLevelAtLeast('gestor', 'atendente')).toBe(true);
    expect(hasWaLevelAtLeast('supervisor', 'gestor')).toBe(false);
    expect(hasWaLevelAtLeast(null, 'atendente')).toBe(false);
  });

  it('só avança o status da mensagem', () => {
    expect(isStatusAhead('sent', 'delivered')).toBe(true);
    expect(isStatusAhead('read', 'delivered')).toBe(false);
    expect(isStatusAhead('delivered', 'failed')).toBe(true);
  });

  it('fecha a janela de 24 h', () => {
    const now = new Date('2026-11-13T12:00:00.000Z');

    expect(isWindowOpen(new Date('2026-11-12T13:00:00.000Z'), now)).toBe(true);
    expect(isWindowOpen(new Date('2026-11-12T11:00:00.000Z'), now)).toBe(false);
    expect(isWindowOpen(null, now)).toBe(false);
  });
});
