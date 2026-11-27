import { readEvolutionDelivery } from './whatsapp-evolution-payload';

const CONTACT = '5531999990000@s.whatsapp.net';

function upsert(data: Record<string, unknown>): Record<string, unknown> {
  return { event: 'messages.upsert', instance: 'azuos', data };
}

describe('whatsapp-evolution-payload', () => {
  it('lê o texto, o contato e a hora da mensagem recebida', () => {
    const delivery = readEvolutionDelivery(
      upsert({
        key: { remoteJid: CONTACT, id: 'BAE5A1B2', fromMe: false },
        pushName: 'Ana Cliente',
        messageTimestamp: 1764200000,
        message: { conversation: 'Bom dia, preciso de ajuda' },
      }),
    );

    expect(delivery.messages).toHaveLength(1);
    expect(delivery.messages[0]).toMatchObject({
      waMessageId: 'BAE5A1B2',
      from: '5531999990000',
      type: 'text',
      body: 'Bom dia, preciso de ajuda',
    });
    expect(delivery.messages[0]?.sentAt.toISOString()).toBe('2025-11-26T23:33:20.000Z');
    expect(delivery.contacts).toEqual([{ waId: '5531999990000', profileName: 'Ana Cliente' }]);
  });

  it('aceita o nome do evento em maiúsculas com sublinhado', () => {
    const delivery = readEvolutionDelivery({
      event: 'MESSAGES_UPSERT',
      instance: 'azuos',
      data: {
        key: { remoteJid: CONTACT, id: 'BAE5', fromMe: false },
        message: { extendedTextMessage: { text: 'oi' } },
      },
    });

    expect(delivery.event).toBe('messages.upsert');
    expect(delivery.messages[0]?.body).toBe('oi');
  });

  it('guarda o base64 da mídia, a legenda e o tipo', () => {
    const delivery = readEvolutionDelivery(
      upsert({
        key: { remoteJid: CONTACT, id: 'IMG1', fromMe: false },
        message: {
          imageMessage: { mimetype: 'image/jpeg', caption: 'segue a foto' },
          base64: 'data:image/jpeg;base64,QUJD',
        },
      }),
    );

    expect(delivery.messages[0]).toMatchObject({
      type: 'image',
      body: 'segue a foto',
      caption: 'segue a foto',
      mime: 'image/jpeg',
      mediaBase64: 'QUJD',
    });
  });

  it('trata o áudio de voz e o documento com nome', () => {
    const audio = readEvolutionDelivery(
      upsert({
        key: { remoteJid: CONTACT, id: 'AUD1', fromMe: false },
        message: { audioMessage: { mimetype: 'audio/ogg; codecs=opus', ptt: true } },
      }),
    );
    const document = readEvolutionDelivery(
      upsert({
        key: { remoteJid: CONTACT, id: 'DOC1', fromMe: false },
        message: {
          documentMessage: { mimetype: 'application/pdf', fileName: 'contrato.pdf' },
        },
      }),
    );

    expect(audio.messages[0]).toMatchObject({ type: 'audio', mime: 'audio/ogg; codecs=opus' });
    expect(document.messages[0]).toMatchObject({
      type: 'document',
      body: 'contrato.pdf',
      filename: 'contrato.pdf',
    });
  });

  it('lê a citação e a resposta de botão', () => {
    const quoted = readEvolutionDelivery(
      upsert({
        key: { remoteJid: CONTACT, id: 'Q1', fromMe: false },
        message: {
          extendedTextMessage: { text: 'isso', contextInfo: { stanzaId: 'ORIGINAL' } },
        },
      }),
    );
    const button = readEvolutionDelivery(
      upsert({
        key: { remoteJid: CONTACT, id: 'B1', fromMe: false },
        message: {
          buttonsResponseMessage: {
            selectedButtonId: 'op-2',
            selectedDisplayText: 'Falar com alguém',
          },
        },
      }),
    );

    expect(quoted.messages[0]?.replyTo).toBe('ORIGINAL');
    expect(button.messages[0]).toMatchObject({
      type: 'interactive',
      body: 'Falar com alguém',
      payload: { kind: 'button_reply', id: 'op-2', title: 'Falar com alguém' },
    });
  });

  it('ignora grupo, status e o eco da própria mensagem', () => {
    const group = readEvolutionDelivery(
      upsert({
        key: { remoteJid: '120363000000000000@g.us', id: 'G1', fromMe: false },
        message: { conversation: 'bom dia a todos' },
      }),
    );
    const status = readEvolutionDelivery(
      upsert({
        key: { remoteJid: 'status@broadcast', id: 'S1', fromMe: false },
        message: { conversation: 'status' },
      }),
    );
    const mine = readEvolutionDelivery(
      upsert({
        key: { remoteJid: CONTACT, id: 'M1', fromMe: true },
        message: { conversation: 'resposta minha' },
      }),
    );

    for (const delivery of [group, status, mine]) {
      expect(delivery.messages).toEqual([]);
      expect(delivery.contacts).toEqual([]);
      expect(delivery.ignored).toBe('no-inbound-message');
    }
  });

  it('traduz o acknowledgement em status da mensagem', () => {
    const read = readEvolutionDelivery({
      event: 'messages.update',
      instance: 'azuos',
      data: [{ keyId: 'OUT1', status: 'READ' }],
    });
    const failed = readEvolutionDelivery({
      event: 'messages.update',
      instance: 'azuos',
      data: { key: { id: 'OUT2' }, status: 'ERROR' },
    });
    const unknown = readEvolutionDelivery({
      event: 'messages.update',
      instance: 'azuos',
      data: { keyId: 'OUT3', status: 'DELETED' },
    });

    expect(read.statuses[0]).toMatchObject({ waMessageId: 'OUT1', status: 'read' });
    expect(failed.statuses[0]?.status).toBe('failed');
    expect(failed.statuses[0]?.error).not.toBeNull();
    expect(unknown.statuses).toEqual([]);
  });

  it('lê o estado da conexão e o QR Code', () => {
    const open = readEvolutionDelivery({
      event: 'connection.update',
      instance: 'azuos',
      data: { state: 'open' },
    });
    const down = readEvolutionDelivery({
      event: 'CONNECTION_UPDATE',
      instance: 'azuos',
      data: { state: 'close', statusReason: 401 },
    });
    const qr = readEvolutionDelivery({
      event: 'qrcode.updated',
      instance: 'azuos',
      data: { qrcode: { base64: 'data:image/png;base64,QQ==', code: '2@abc' } },
    });

    expect(open.state).toBe('open');
    expect(down.state).toBe('close');
    expect(qr.qrCode).toBe('data:image/png;base64,QQ==');
  });

  it('não age em evento que o módulo não trata', () => {
    const delivery = readEvolutionDelivery({
      event: 'presence.update',
      instance: 'azuos',
      data: {},
    });

    expect(delivery.ignored).toBe('event-not-handled:presence.update');
    expect(delivery.messages).toEqual([]);
  });
});
