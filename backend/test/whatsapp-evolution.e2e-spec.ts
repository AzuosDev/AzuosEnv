import request from 'supertest';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SecretsService } from '../src/modules/secrets/secrets.service';
import { EvolutionProvider } from '../src/modules/whatsapp/providers/evolution.provider';
import { WaInstanceStatus, WaOutbound } from '../src/modules/whatsapp/providers/whatsapp.provider';
import { WaConnection } from '../src/modules/whatsapp/schemas/wa-connection.schema';
import { WhatsappConnectionMonitor } from '../src/modules/whatsapp/whatsapp-connection.monitor';
import { WhatsappWebhookService } from '../src/modules/whatsapp/whatsapp-webhook.service';
import { Session, createSession } from './utils/auth-client';
import { TestApp, createTestApp } from './utils/e2e-app';

interface IdBody {
  id: string;
}

interface ConversationBody extends IdBody {
  status: 'open' | 'waiting' | 'closed';
  unreadCount: number;
  lastInboundAt: string | null;
}

interface MessageBody extends IdBody {
  waMessageId: string | null;
  direction: 'inbound' | 'outbound';
  type: string;
  body: string;
  status: string;
  media: { mime: string; size: number; filename: string } | null;
}

interface NotificationBody extends IdBody {
  type: string;
  data: Record<string, unknown>;
}

interface Fixture {
  owner: Session;
  workspace: IdBody;
  /** Public URL of the webhook, with the secret the backend generated. */
  webhookUrl: string;
}

const BASE_URL = 'https://evolution.azuos.invalid';
const API_KEY = 'chave-da-evolution';
const INSTANCE = 'azuos-atendimento';
const CONTACT = '5531999990000';
const CONTACT_JID = `${CONTACT}@s.whatsapp.net`;
const PIXEL = Buffer.from('conteudo-da-imagem').toString('base64');

/** Evolution API scripted by each test; nothing leaves the process. */
const fakeEvolution = {
  sent: [] as WaOutbound[],
  reads: [] as string[],
  webhooks: [] as string[],
  created: [] as string[],
  restarts: 0,
  disconnects: 0,
  /** What `state` answers, so the monitor can be driven. */
  current: 'open' as WaInstanceStatus['state'],
  /** null deixa todo número passar; a lista diz quais existem. */
  existing: null as string[] | null,
  send: (_credentials: unknown, message: WaOutbound): Promise<string> => {
    fakeEvolution.sent.push(message);

    return Promise.resolve(`EVO.OUT.${String(fakeEvolution.sent.length)}`);
  },
  inboundMedia: (_credentials: unknown, request: { base64: string | null; mime: string | null }) =>
    Promise.resolve(
      request.base64
        ? { buffer: Buffer.from(request.base64, 'base64'), mime: request.mime ?? '' }
        : null,
    ),
  markRead: (_credentials: unknown, waMessageId: string): Promise<void> => {
    fakeEvolution.reads.push(waMessageId);

    return Promise.resolve();
  },
  templates: () => Promise.resolve([]),
  phoneInfo: () =>
    Promise.resolve({ displayPhone: CONTACT, verifiedName: 'Azuos Dev', qualityRating: '' }),
  setWebhook: (_credentials: unknown, webhookUrl: string): Promise<void> => {
    fakeEvolution.webhooks.push(webhookUrl);

    return Promise.resolve();
  },
  createInstance: (_credentials: unknown, webhookUrl: string): Promise<WaInstanceStatus> => {
    fakeEvolution.created.push(webhookUrl);
    fakeEvolution.webhooks.push(webhookUrl);

    return Promise.resolve({
      state: 'connecting',
      qrCode: 'data:image/png;base64,UVJDT0RF',
      displayPhone: '',
      verifiedName: '',
    });
  },
  connect: (): Promise<WaInstanceStatus> =>
    Promise.resolve({
      state: 'connecting',
      qrCode: 'data:image/png;base64,UVJDT0RF',
      displayPhone: '',
      verifiedName: '',
    }),
  state: (): Promise<WaInstanceStatus> =>
    Promise.resolve({
      state: fakeEvolution.current,
      qrCode: null,
      displayPhone: fakeEvolution.current === 'open' ? CONTACT : '',
      verifiedName: fakeEvolution.current === 'open' ? 'Azuos Dev' : '',
    }),
  disconnect: (): Promise<void> => {
    fakeEvolution.disconnects += 1;

    return Promise.resolve();
  },
  restart: (): Promise<WaInstanceStatus> => {
    fakeEvolution.restarts += 1;

    return Promise.resolve({
      state: 'connecting',
      qrCode: null,
      displayPhone: '',
      verifiedName: '',
    });
  },
  existingNumbers: (_credentials: unknown, waIds: string[]): Promise<string[]> =>
    Promise.resolve(fakeEvolution.existing ?? waIds),
};

describe('WhatsApp — conexão pela Evolution', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp({
      overrides: [{ token: EvolutionProvider, value: fakeEvolution }],
    });
  });

  beforeEach(() => {
    fakeEvolution.sent = [];
    fakeEvolution.reads = [];
    fakeEvolution.webhooks = [];
    fakeEvolution.created = [];
    fakeEvolution.restarts = 0;
    fakeEvolution.disconnects = 0;
    fakeEvolution.current = 'open';
    fakeEvolution.existing = null;
  });

  afterEach(async () => {
    await ctx.clearDatabase();
  });

  afterAll(async () => {
    await ctx.close();
  });

  const http = (): request.Agent => request(ctx.httpServer as never);

  const withAuth = (test: request.Test, session: Session): request.Test =>
    test
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('X-Forwarded-For', session.credentials.ip);

  /** URL pública do webhook: o segredo só existe criptografado no documento. */
  async function webhookUrlOf(): Promise<string> {
    const model = ctx.app.get<Model<WaConnection>>(getModelToken(WaConnection.name));
    const connection = await model.findOne({}).select('+webhookSecret').exec();

    if (!connection) {
      throw new Error('conexão não encontrada');
    }

    const secret = ctx.app.get(SecretsService).tryDecrypt(connection.webhookSecret);

    return `/api/v1/integrations/whatsapp/evolution/${String(connection._id)}/${String(secret)}`;
  }

  /** Cria o workspace, salva a conexão da Evolution e pareia o número. */
  async function setup(): Promise<Fixture> {
    const owner = await createSession(ctx);
    const workspace = (
      await withAuth(http().post('/api/v1/workspaces'), owner)
        .send({ name: 'Azuos Dev', taskPrefix: 'AZD', timezone: 'UTC' })
        .expect(201)
    ).body as IdBody;

    await withAuth(http().put(`/api/v1/workspaces/${workspace.id}/whatsapp/connection`), owner)
      .send({ provider: 'evolution', baseUrl: BASE_URL, apiKey: API_KEY, instanceName: INSTANCE })
      .expect(200);

    return { owner, workspace, webhookUrl: await webhookUrlOf() };
  }

  /** Entrega um evento da Evolution e espera a fila do processamento. */
  async function deliver(
    fixture: Fixture,
    body: Record<string, unknown>,
    url = fixture.webhookUrl,
  ): Promise<request.Response> {
    const response = await http()
      .post(url)
      .set('X-Forwarded-For', '10.95.0.1')
      .set('content-type', 'application/json')
      .send(body);

    if (response.status === 200) {
      await ctx.app.get(WhatsappWebhookService).settle();
    }

    return response;
  }

  function inbound(id: string, message: Record<string, unknown>): Record<string, unknown> {
    return {
      event: 'messages.upsert',
      instance: INSTANCE,
      data: {
        key: { remoteJid: CONTACT_JID, id, fromMe: false },
        pushName: 'Ana Cliente',
        messageTimestamp: Math.floor(Date.now() / 1000),
        message,
      },
    };
  }

  async function conversations(fixture: Fixture): Promise<ConversationBody[]> {
    const response = await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/whatsapp/conversations?filter=all`),
      fixture.owner,
    ).expect(200);

    return response.body.items as ConversationBody[];
  }

  async function messagesOf(fixture: Fixture, conversationId: string): Promise<MessageBody[]> {
    const response = await withAuth(
      http().get(
        `/api/v1/workspaces/${fixture.workspace.id}/whatsapp/conversations/${conversationId}/messages`,
      ),
      fixture.owner,
    ).expect(200);

    return response.body.items as MessageBody[];
  }

  /** Os ouvintes rodam depois da resposta, então o Inbox é lido até assentar. */
  async function inboxOf(fixture: Fixture): Promise<NotificationBody[]> {
    const response = await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/inbox?tab=primary`),
      fixture.owner,
    ).expect(200);

    return (response.body.items as NotificationBody[]).filter(
      (item) => item.type === 'whatsappConnection',
    );
  }

  async function waitForWarning(fixture: Fixture): Promise<NotificationBody[]> {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const found = await inboxOf(fixture);

      if (found.length > 0) {
        return found;
      }

      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    return [];
  }

  it('cria a instância com o webhook desta API e devolve o QR Code', async () => {
    const fixture = await setup();
    const status = await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/whatsapp/connection`),
      fixture.owner,
    ).expect(200);

    expect(status.body.connection).toMatchObject({
      provider: 'evolution',
      baseUrl: BASE_URL,
      instanceName: INSTANCE,
      status: 'pending',
    });
    expect(status.body.capabilities).toEqual({ templates: false, window: false, qrCode: true });
    // A chave da API nunca volta para a tela.
    expect(status.body.connection.apiKey).toBeUndefined();

    const connect = await withAuth(
      http().post(`/api/v1/workspaces/${fixture.workspace.id}/whatsapp/connection/connect`),
      fixture.owner,
    ).expect(201);

    expect(connect.body).toMatchObject({ qrCode: 'data:image/png;base64,UVJDT0RF' });
    expect(connect.body.status).toBe('pending');
    expect(fakeEvolution.created[0]?.endsWith(fixture.webhookUrl)).toBe(true);

    const qr = await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/whatsapp/connection/qr`),
      fixture.owner,
    ).expect(200);

    expect(qr.body.qrCode).toBe('data:image/png;base64,UVJDT0RF');
  });

  it('atualiza o QR Code e confirma a conexão pelo webhook', async () => {
    const fixture = await setup();

    await deliver(fixture, {
      event: 'qrcode.updated',
      instance: INSTANCE,
      data: { qrcode: { base64: 'data:image/png;base64,Tk9WTw==' } },
    }).then((response) => expect(response.status).toBe(200));

    const qr = await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/whatsapp/connection/qr`),
      fixture.owner,
    ).expect(200);

    expect(qr.body.qrCode).toBe('data:image/png;base64,Tk9WTw==');

    await deliver(fixture, {
      event: 'connection.update',
      instance: INSTANCE,
      data: { state: 'open' },
    }).then((response) => expect(response.status).toBe(200));

    const status = await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/whatsapp/connection`),
      fixture.owner,
    ).expect(200);

    expect(status.body.connection.status).toBe('connected');
    // Conectado não tem QR Code pendente.
    expect(
      (
        await withAuth(
          http().get(`/api/v1/workspaces/${fixture.workspace.id}/whatsapp/connection/qr`),
          fixture.owner,
        ).expect(200)
      ).body.qrCode,
    ).toBeNull();
  });

  it('recebe texto, áudio de voz e imagem com o arquivo no storage', async () => {
    const fixture = await setup();

    await deliver(fixture, inbound('EVO.1', { conversation: 'Bom dia, preciso de ajuda' })).then(
      (response) => expect(response.status).toBe(200),
    );
    await deliver(
      fixture,
      inbound('EVO.2', {
        audioMessage: { mimetype: 'audio/ogg; codecs=opus', ptt: true },
        base64: PIXEL,
      }),
    ).then((response) => expect(response.status).toBe(200));
    await deliver(
      fixture,
      inbound('EVO.3', {
        imageMessage: { mimetype: 'image/jpeg', caption: 'Comprovante' },
        base64: PIXEL,
      }),
    ).then((response) => expect(response.status).toBe(200));

    const [conversation] = await conversations(fixture);

    expect(conversation).toMatchObject({ status: 'open', unreadCount: 3 });

    const messages = await messagesOf(fixture, conversation.id);
    const byId = new Map(messages.map((message) => [message.waMessageId, message]));

    expect(byId.get('EVO.1')).toMatchObject({ type: 'text', body: 'Bom dia, preciso de ajuda' });
    expect(byId.get('EVO.2')).toMatchObject({ type: 'audio' });
    expect(byId.get('EVO.2')?.media).toMatchObject({ mime: 'audio/ogg; codecs=opus', size: 18 });
    expect(byId.get('EVO.3')).toMatchObject({ type: 'image', body: 'Comprovante' });

    const media = await withAuth(
      http().get(
        `/api/v1/workspaces/${fixture.workspace.id}/whatsapp/conversations/${conversation.id}/messages/${String(byId.get('EVO.3')?.id)}/media`,
      ),
      fixture.owner,
    ).expect(200);

    expect(media.headers['content-type']).toContain('image/jpeg');
  });

  it('envia texto e mídia sem janela de 24 h e recusa template', async () => {
    const fixture = await setup();

    await deliver(fixture, inbound('EVO.10', { conversation: 'oi' })).then((response) =>
      expect(response.status).toBe(200),
    );

    const [conversation] = await conversations(fixture);
    const base = `/api/v1/workspaces/${fixture.workspace.id}/whatsapp/conversations/${conversation.id}`;
    const text = await withAuth(http().post(`${base}/messages`), fixture.owner)
      .send({ text: 'Bom dia! Já verifico.' })
      .expect(201);

    expect(text.body).toMatchObject({ direction: 'outbound', status: 'sent' });
    expect(fakeEvolution.sent[0]).toMatchObject({ to: CONTACT, type: 'text' });

    const file = await withAuth(http().post(`${base}/messages/media`), fixture.owner)
      .field('caption', 'Segue o contrato')
      .attach('file', Buffer.from('%PDF-1.4 teste'), {
        filename: 'contrato.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    expect(file.body).toMatchObject({ type: 'document', direction: 'outbound' });
    expect(fakeEvolution.sent[1]?.file).toMatchObject({ filename: 'contrato.pdf' });

    const templates = await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/whatsapp/templates`),
      fixture.owner,
    ).expect(200);

    expect(templates.body.items).toEqual([]);

    const refused = await withAuth(http().post(`${base}/messages/template`), fixture.owner)
      .send({ name: 'retorno_atendimento', language: 'pt_BR' })
      .expect(409);

    expect(refused.body.code).toBe('WHATSAPP_TEMPLATES_UNSUPPORTED');
  });

  it('aplica o status de leitura e marca a conversa como lida', async () => {
    const fixture = await setup();

    await deliver(fixture, inbound('EVO.20', { conversation: 'oi' })).then((response) =>
      expect(response.status).toBe(200),
    );

    const [conversation] = await conversations(fixture);
    const base = `/api/v1/workspaces/${fixture.workspace.id}/whatsapp/conversations/${conversation.id}`;
    const sent = await withAuth(http().post(`${base}/messages`), fixture.owner)
      .send({ text: 'Já verifico.' })
      .expect(201);
    const waMessageId = sent.body.waMessageId as string;

    await deliver(fixture, {
      event: 'messages.update',
      instance: INSTANCE,
      data: { keyId: waMessageId, status: 'READ' },
    }).then((response) => expect(response.status).toBe(200));

    const messages = await messagesOf(fixture, conversation.id);

    expect(messages.find((message) => message.waMessageId === waMessageId)?.status).toBe('read');

    const read = await withAuth(http().post(`${base}/read`), fixture.owner).expect(201);

    expect(read.body.unreadCount).toBe(0);
    expect(fakeEvolution.reads).toEqual(['EVO.20']);
  });

  it('recusa o segredo errado com 404 e não cria conversa', async () => {
    const fixture = await setup();
    const [connectionId = ''] = fixture.webhookUrl.split('/').slice(-2);

    await deliver(
      fixture,
      inbound('EVO.30', { conversation: 'oi' }),
      `/api/v1/integrations/whatsapp/evolution/${connectionId}/segredo-errado`,
    ).then((response) => expect(response.status).toBe(404));

    await deliver(
      fixture,
      inbound('EVO.31', { conversation: 'oi' }),
      '/api/v1/integrations/whatsapp/evolution/000000000000000000000000/qualquer',
    ).then((response) => expect(response.status).toBe(404));

    expect(await conversations(fixture)).toEqual([]);
  });

  it('não duplica a mensagem repetida e ignora grupo e status', async () => {
    const fixture = await setup();
    const repeated = inbound('EVO.40', { conversation: 'Bom dia' });

    await deliver(fixture, repeated).then((response) => expect(response.status).toBe(200));
    await deliver(fixture, repeated).then((response) => expect(response.status).toBe(200));

    const group = await deliver(fixture, {
      event: 'messages.upsert',
      instance: INSTANCE,
      data: {
        key: { remoteJid: '120363000000000000@g.us', id: 'EVO.41', fromMe: false },
        pushName: 'Grupo da obra',
        message: { conversation: 'bom dia a todos' },
      },
    });
    const status = await deliver(fixture, {
      event: 'messages.upsert',
      instance: INSTANCE,
      data: {
        key: { remoteJid: 'status@broadcast', id: 'EVO.42', fromMe: false },
        message: { conversation: 'status novo' },
      },
    });

    expect(group.body).toMatchObject({ ignored: 'no-inbound-message' });
    expect(status.body).toMatchObject({ ignored: 'no-inbound-message' });

    const list = await conversations(fixture);

    expect(list).toHaveLength(1);
    expect(await messagesOf(fixture, list[0]?.id ?? '')).toHaveLength(1);
  });

  it('o vigia marca a queda e avisa o gestor no Inbox', async () => {
    const fixture = await setup();

    await deliver(fixture, {
      event: 'connection.update',
      instance: INSTANCE,
      data: { state: 'open' },
    }).then((response) => expect(response.status).toBe(200));

    fakeEvolution.current = 'close';
    await ctx.app.get(WhatsappConnectionMonitor).run();

    const status = await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/whatsapp/connection`),
      fixture.owner,
    ).expect(200);

    expect(status.body.connection).toMatchObject({ status: 'disconnected' });
    expect(status.body.connection.disconnectedAt).not.toBeNull();

    const warnings = await waitForWarning(fixture);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.data.status).toBe('disconnected');

    // O segundo ciclo não avisa de novo: a queda já estava registrada.
    await ctx.app.get(WhatsappConnectionMonitor).run();

    expect(await inboxOf(fixture)).toHaveLength(1);
  });

  it('desconecta, reinicia e normaliza o nono dígito do número novo', async () => {
    const fixture = await setup();
    const base = `/api/v1/workspaces/${fixture.workspace.id}/whatsapp`;

    await withAuth(http().post(`${base}/connection/restart`), fixture.owner).expect(201);
    expect(fakeEvolution.restarts).toBe(1);

    // Só a forma de oito dígitos existe no WhatsApp: é ela que vira o contato.
    fakeEvolution.existing = ['553199990000'];

    const contact = await withAuth(http().post(`${base}/contacts`), fixture.owner)
      .send({ waId: '5531999990000', name: 'Ana Cliente' })
      .expect(201);

    expect(contact.body.waId).toBe('553199990000');

    fakeEvolution.existing = ['nenhum'];

    const refused = await withAuth(http().post(`${base}/contacts`), fixture.owner)
      .send({ waId: '5531988880000' })
      .expect(409);

    expect(refused.body.code).toBe('WHATSAPP_NUMBER_NOT_FOUND');

    const disconnected = await withAuth(
      http().post(`${base}/connection/disconnect`),
      fixture.owner,
    ).expect(201);

    expect(fakeEvolution.disconnects).toBe(1);
    expect(disconnected.body.connection.status).toBe('disconnected');
  });
});
