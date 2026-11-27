import { EvolutionProvider } from './evolution.provider';
import { WaCredentials } from './whatsapp.provider';

const INSTANCE = 'azuos-env';

const credentials: WaCredentials = {
  provider: 'evolution',
  phoneNumberId: '',
  wabaId: '',
  accessToken: '',
  baseUrl: 'https://evolution.azuos.invalid/',
  apiKey: 'chave-da-evolution',
  instanceName: INSTANCE,
};

interface Call {
  url: string;
  method: string;
  apiKey: string;
  body: unknown;
}

/**
 * O servidor da Evolution é compartilhado com outros sistemas, então o que este
 * spec guarda não é o formato de uma chamada: é o escopo. Toda rota tem de levar
 * o nome da instância da conexão, e nenhuma pode listar, excluir ou configurar
 * o servidor — é isso que impede o módulo de mexer no WhatsApp de terceiros.
 */
describe('EvolutionProvider', () => {
  let provider: EvolutionProvider;
  let calls: Call[];
  let reply: { status: number; body: unknown };

  beforeEach(() => {
    provider = new EvolutionProvider();
    calls = [];
    reply = { status: 200, body: { key: { id: 'EVO.1' }, instance: { state: 'open' } } };

    globalThis.fetch = ((url: string, init: RequestInit = {}) => {
      const headers = (init.headers ?? {}) as Record<string, string>;

      calls.push({
        url,
        method: init.method ?? 'GET',
        apiKey: headers.apikey ?? '',
        body: typeof init.body === 'string' ? JSON.parse(init.body) : null,
      });

      return Promise.resolve({
        ok: reply.status < 400,
        status: reply.status,
        text: () => Promise.resolve(JSON.stringify(reply.body)),
      } as Response);
    }) as typeof fetch;
  });

  /** Caminho chamado, já sem a origem do servidor. */
  const pathOf = (call: Call): string => call.url.replace('https://evolution.azuos.invalid/', '');

  async function callEverything(): Promise<void> {
    await provider.createInstance(credentials, 'https://api.azuos.invalid/webhook');
    await provider.setWebhook(credentials, 'https://api.azuos.invalid/webhook');
    await provider.connect(credentials);
    await provider.state(credentials);
    await provider.instanceExists(credentials);
    await provider.disconnect(credentials);
    await provider.restart(credentials);
    await provider.send(credentials, { to: '5531999990000', type: 'text', text: 'oi' });
    await provider.markRead(credentials, 'EVO.1');
    await provider.existingNumbers(credentials, ['5531999990000']);
  }

  it('toda chamada fala da instância da conexão, e de nenhuma outra', async () => {
    await callEverything();

    expect(calls).not.toHaveLength(0);

    for (const call of calls) {
      const path = pathOf(call);
      const named = path.includes(INSTANCE);
      // `instance/create` é a única rota sem o nome no caminho: ele vai no corpo.
      const inBody = (call.body as { instanceName?: string } | null)?.instanceName === INSTANCE;

      expect(named || inBody).toBe(true);
      expect(call.apiKey).toBe('chave-da-evolution');
    }
  });

  it('não lista, não exclui e não configura o servidor', async () => {
    await callEverything();

    const paths = calls.map(pathOf);

    for (const forbidden of [
      'instance/fetchInstances',
      'instance/delete',
      'settings/set',
      'settings/find',
      'proxy/set',
      'instance/fetch',
    ]) {
      expect(paths.some((path) => path.startsWith(forbidden))).toBe(false);
    }

    expect(paths.some((path) => path.includes('delete'))).toBe(false);
  });

  it('usa as rotas da v2 esperadas, cada uma no seu método', async () => {
    await callEverything();

    const seen = calls.map((call) => `${call.method} ${pathOf(call)}`);

    expect(seen).toEqual([
      'POST instance/create',
      `POST webhook/set/${INSTANCE}`,
      `GET instance/connect/${INSTANCE}`,
      `GET instance/connectionState/${INSTANCE}`,
      `GET instance/connectionState/${INSTANCE}`,
      `DELETE instance/logout/${INSTANCE}`,
      `POST instance/restart/${INSTANCE}`,
      `POST message/sendText/${INSTANCE}`,
      `POST chat/markMessageAsRead/${INSTANCE}`,
      `POST chat/whatsappNumbers/${INSTANCE}`,
    ]);
  });

  it('cria a instância na integração Baileys com o webhook desta API', async () => {
    await provider.createInstance(credentials, 'https://api.azuos.invalid/webhook');

    expect(calls[0]?.body).toMatchObject({
      instanceName: INSTANCE,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
      webhook: {
        enabled: true,
        url: 'https://api.azuos.invalid/webhook',
        byEvents: false,
        base64: true,
      },
    });
  });

  it('404 na consulta é instância livre; outra falha estoura', async () => {
    reply = { status: 404, body: { message: 'instance does not exist' } };

    await expect(provider.instanceExists(credentials)).resolves.toBe(false);

    reply = { status: 500, body: { message: 'boom' } };

    await expect(provider.instanceExists(credentials)).rejects.toThrow(/Evolution/);
  });

  it('áudio de voz tem endpoint próprio e a mídia vai em base64', async () => {
    const file = { filename: 'nota.ogg', mime: 'audio/ogg', buffer: Buffer.from('audio') };

    await provider.send(credentials, { to: '5531999990000', type: 'audio', file });
    await provider.send(credentials, {
      to: '5531999990000',
      type: 'document',
      file: { filename: 'contrato.pdf', mime: 'application/pdf', buffer: Buffer.from('pdf') },
      caption: 'Segue',
      replyTo: 'EVO.CITADA',
    });

    expect(pathOf(calls[0] as Call)).toBe(`message/sendWhatsAppAudio/${INSTANCE}`);
    expect(calls[0]?.body).toMatchObject({ audio: file.buffer.toString('base64') });
    expect(pathOf(calls[1] as Call)).toBe(`message/sendMedia/${INSTANCE}`);
    expect(calls[1]?.body).toMatchObject({
      mediatype: 'document',
      mimetype: 'application/pdf',
      fileName: 'contrato.pdf',
      caption: 'Segue',
      quoted: { key: { id: 'EVO.CITADA' } },
    });
  });

  it('pergunta pelos números em JID e devolve só os que existem', async () => {
    reply = {
      status: 200,
      body: [
        { jid: '5531999990000@s.whatsapp.net', exists: false },
        { jid: '553199990000@s.whatsapp.net', exists: true },
      ],
    };

    await expect(
      provider.existingNumbers(credentials, ['5531999990000', '553199990000']),
    ).resolves.toEqual(['553199990000']);
    expect(calls[0]?.body).toMatchObject({
      numbers: ['5531999990000@s.whatsapp.net', '553199990000@s.whatsapp.net'],
    });
  });
});
