import request from 'supertest';
import { AI_PROVIDER } from '../src/modules/ai/ai-provider';
import { StubAiProvider } from '../src/modules/ai/stub-ai.provider';
import {
  WaOutbound,
  WaTemplate,
  WaUploadInput,
  WhatsappGraphProvider,
} from '../src/modules/whatsapp/graph/whatsapp-graph.provider';
import { WhatsappWebhookService } from '../src/modules/whatsapp/whatsapp-webhook.service';
import { signBody } from '../src/modules/integrations/webhooks/webhook-signature';
import { Session, createSession } from './utils/auth-client';
import { TestApp, createTestApp } from './utils/e2e-app';

interface IdBody {
  id: string;
}

interface ConversationBody extends IdBody {
  status: 'open' | 'waiting' | 'closed';
  mode: 'bot' | 'human';
  botPausedUntil: string | null;
  assigneeId: string | null;
  priority: string;
}

interface MessageBody extends IdBody {
  direction: 'inbound' | 'outbound';
  type: string;
  body: string;
  fromBot: boolean;
}

interface Fixture {
  owner: Session;
  ana: Session;
  anaId: string;
  outsider: Session;
  workspace: IdBody;
}

const PHONE_NUMBER_ID = '2098765';
const APP_SECRET = 'segredo-do-app-do-bot';
const VERIFY_TOKEN = 'token-de-verificacao-bot';
const CONTACT = '5531988880000';
const OTHER_CONTACT = '5531977770000';

/** WhatsApp Cloud API scripted by each test; nothing leaves the process. */
const fakeGraph = {
  sent: [] as WaOutbound[],
  send: (_credentials: unknown, message: WaOutbound): Promise<string> => {
    fakeGraph.sent.push(message);

    return Promise.resolve(`wamid.bot.${fakeGraph.sent.length}.${Date.now()}`);
  },
  upload: (_credentials: unknown, _file: WaUploadInput): Promise<string> =>
    Promise.resolve('media-enviada'),
  mediaInfo: () => Promise.resolve(null),
  download: () => Promise.resolve(null),
  markRead: (): Promise<void> => Promise.resolve(),
  templates: (): Promise<WaTemplate[]> => Promise.resolve([]),
  phoneInfo: () =>
    Promise.resolve({
      displayPhone: '+55 31 98888-0000',
      verifiedName: 'Azuos',
      qualityRating: '',
    }),
};

describe('WhatsApp — bot e configurações do atendimento', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp({
      overrides: [{ token: WhatsappGraphProvider, value: fakeGraph }],
    });
  });

  beforeEach(() => {
    fakeGraph.sent = [];
    provider().reset();
  });

  afterEach(async () => {
    await ctx.clearDatabase();
  });

  afterAll(async () => {
    await ctx.close();
  });

  const http = (): request.Agent => request(ctx.httpServer as never);

  function provider(): StubAiProvider {
    return ctx.app.get<StubAiProvider>(AI_PROVIDER);
  }

  const withAuth = (test: request.Test, session: Session): request.Test =>
    test
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('X-Forwarded-For', session.credentials.ip);

  async function addMember(workspace: IdBody, owner: Session): Promise<Session> {
    const session = await createSession(ctx);
    const invite = await withAuth(http().post(`/api/v1/workspaces/${workspace.id}/invites`), owner)
      .send({ email: session.credentials.email, role: 'member' })
      .expect(201);

    await http()
      .post('/api/v1/invites/accept')
      .set('X-Forwarded-For', session.credentials.ip)
      .send({ token: invite.body.token })
      .expect(200);

    return session;
  }

  async function userIdOf(session: Session): Promise<string> {
    const me = await withAuth(http().get('/api/v1/auth/me'), session).expect(200);

    return me.body.id as string;
  }

  async function setup(): Promise<Fixture> {
    const owner = await createSession(ctx);
    const workspace = (
      await withAuth(http().post('/api/v1/workspaces'), owner)
        .send({ name: 'Azuos Dev', taskPrefix: 'AZD', timezone: 'UTC' })
        .expect(201)
    ).body as IdBody;
    const ana = await addMember(workspace, owner);
    const outsider = await addMember(workspace, owner);
    const anaId = await userIdOf(ana);

    await withAuth(http().put(`/api/v1/workspaces/${workspace.id}/whatsapp/access/${anaId}`), owner)
      .send({ level: 'atendente' })
      .expect(200);

    await withAuth(http().put(`/api/v1/workspaces/${workspace.id}/whatsapp/connection`), owner)
      .send({
        phoneNumberId: PHONE_NUMBER_ID,
        wabaId: '666000',
        accessToken: 'token-da-graph',
        appSecret: APP_SECRET,
        verifyToken: VERIFY_TOKEN,
      })
      .expect(200);

    return { owner, ana, anaId, outsider, workspace };
  }

  const botUrl = (fixture: Fixture): string =>
    `/api/v1/workspaces/${fixture.workspace.id}/whatsapp/bot`;

  async function saveBot(fixture: Fixture, body: Record<string, unknown>): Promise<void> {
    await withAuth(http().put(botUrl(fixture)), fixture.owner)
      .send(body)
      .expect(200);
  }

  async function createRule(fixture: Fixture, body: Record<string, unknown>): Promise<IdBody> {
    const response = await withAuth(http().post(`${botUrl(fixture)}/rules`), fixture.owner)
      .send(body)
      .expect(201);

    return response.body as IdBody;
  }

  function envelope(value: Record<string, unknown>): string {
    return JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '666000',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: CONTACT, phone_number_id: PHONE_NUMBER_ID },
                ...value,
              },
            },
          ],
        },
      ],
    });
  }

  function textMessage(id: string, text: string, from = CONTACT): Record<string, unknown> {
    return {
      contacts: [{ wa_id: from, profile: { name: from === CONTACT ? 'Ana Cliente' : 'Bruno' } }],
      messages: [
        {
          id,
          from,
          timestamp: String(Math.floor((Date.now() - 60_000) / 1000)),
          type: 'text',
          text: { body: text },
        },
      ],
    };
  }

  function optionMessage(id: string, optionId: string, title: string): Record<string, unknown> {
    return {
      contacts: [{ wa_id: CONTACT, profile: { name: 'Ana Cliente' } }],
      messages: [
        {
          id,
          from: CONTACT,
          timestamp: String(Math.floor((Date.now() - 30_000) / 1000)),
          type: 'interactive',
          interactive: { type: 'button_reply', button_reply: { id: optionId, title } },
        },
      ],
    };
  }

  /** Posts a signed delivery and waits for the asynchronous processing. */
  async function deliver(payload: string): Promise<void> {
    await http()
      .post('/api/v1/integrations/whatsapp/webhook')
      .set('X-Forwarded-For', '10.91.0.1')
      .set('content-type', 'application/json')
      .set('X-Hub-Signature-256', signBody(payload, APP_SECRET))
      .send(payload)
      .expect(200);

    await ctx.app.get(WhatsappWebhookService).settle();
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

  const outbound = (): WaOutbound[] => fakeGraph.sent;

  it('manda boas-vindas e o menu interativo na primeira mensagem', async () => {
    const fixture = await setup();

    await saveBot(fixture, {
      enabled: true,
      welcomeMessage: 'Olá {nome}, aqui é a Azuos!',
      menu: {
        enabled: true,
        kind: 'buttons',
        body: 'Como posso ajudar?',
        options: [
          { id: 'opt-suporte', title: 'Suporte' },
          { id: 'opt-comercial', title: 'Comercial' },
        ],
      },
    });

    await deliver(envelope(textMessage('wamid.b1', 'Bom dia')));

    expect(outbound()).toHaveLength(2);
    expect(outbound()[0]).toMatchObject({
      to: CONTACT,
      type: 'text',
      text: 'Olá Ana Cliente, aqui é a Azuos!',
    });
    expect(outbound()[1]).toMatchObject({ type: 'interactive' });
    expect(outbound()[1].interactive).toMatchObject({
      kind: 'buttons',
      body: 'Como posso ajudar?',
      options: [
        { id: 'opt-suporte', title: 'Suporte' },
        { id: 'opt-comercial', title: 'Comercial' },
      ],
    });

    const [conversation] = await conversations(fixture);
    const messages = await messagesOf(fixture, conversation.id);
    const fromBot = messages.filter((message) => message.fromBot);

    expect(fromBot).toHaveLength(2);
    expect(fromBot.every((message) => message.direction === 'outbound')).toBe(true);
  });

  it('bot desligado não responde nada', async () => {
    const fixture = await setup();

    await saveBot(fixture, { enabled: false, welcomeMessage: 'Olá!' });
    await deliver(envelope(textMessage('wamid.b0', 'Bom dia')));

    expect(outbound()).toHaveLength(0);
  });

  it('palavra-chave responde e a opção do menu dispara a regra', async () => {
    const fixture = await setup();

    await saveBot(fixture, { enabled: true, welcomeMessage: 'Olá!' });
    await createRule(fixture, {
      name: 'Horário',
      trigger: { kind: 'keyword', value: 'horário' },
      reply: { kind: 'text', text: 'Atendemos de 9h às 18h.' },
      priority: 10,
    });
    await createRule(fixture, {
      name: 'Suporte pelo menu',
      trigger: { kind: 'menuOption', value: 'opt-suporte' },
      reply: { kind: 'text', text: 'Suporte na linha, {nome}.' },
      actions: [{ kind: 'priority', priority: 'urgent' }],
    });

    await deliver(envelope(textMessage('wamid.k1', 'Bom dia')));

    expect(outbound()).toHaveLength(1);

    await deliver(envelope(textMessage('wamid.k2', 'Qual o HORARIO de vocês?')));

    expect(outbound()[1]).toMatchObject({ type: 'text', text: 'Atendemos de 9h às 18h.' });

    await deliver(envelope(optionMessage('wamid.k3', 'opt-suporte', 'Suporte')));

    expect(outbound()[2]).toMatchObject({ type: 'text', text: 'Suporte na linha, Ana Cliente.' });

    const [conversation] = await conversations(fixture);

    expect(conversation.priority).toBe('urgent');
  });

  it('transferir para humano troca o modo e avisa o contato', async () => {
    const fixture = await setup();

    await saveBot(fixture, {
      enabled: true,
      welcomeMessage: 'Olá!',
      handoffMessage: 'Vou chamar um atendente.',
    });
    await createRule(fixture, {
      name: 'Falar com humano',
      trigger: { kind: 'contains', value: 'atendente' },
      reply: { kind: 'none' },
      actions: [{ kind: 'transferToHuman' }, { kind: 'tag', tag: 'quer-humano' }],
    });

    await deliver(envelope(textMessage('wamid.h1', 'Bom dia')));
    await deliver(envelope(textMessage('wamid.h2', 'quero falar com um Atendente')));

    expect(outbound()[1]).toMatchObject({ text: 'Vou chamar um atendente.' });

    const [conversation] = await conversations(fixture);

    expect(conversation.mode).toBe('human');

    const contacts = await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/whatsapp/contacts`),
      fixture.owner,
    ).expect(200);

    expect(contacts.body.items[0].tags).toEqual(['quer-humano']);

    // Em modo humano o bot já não responde a palavra-chave nenhuma.
    await deliver(envelope(textMessage('wamid.h3', 'Bom dia')));

    expect(outbound()).toHaveLength(2);
  });

  it('resposta do atendente pausa o bot e devolver ao bot reativa', async () => {
    const fixture = await setup();

    await saveBot(fixture, { enabled: true, welcomeMessage: 'Olá!', pauseMinutes: 30 });
    await createRule(fixture, {
      name: 'Horário',
      trigger: { kind: 'keyword', value: 'horário' },
      reply: { kind: 'text', text: 'Atendemos de 9h às 18h.' },
    });

    await deliver(envelope(textMessage('wamid.p1', 'Bom dia')));

    const [conversation] = await conversations(fixture);
    const base = `/api/v1/workspaces/${fixture.workspace.id}/whatsapp/conversations/${conversation.id}`;

    await withAuth(http().post(`${base}/messages`), fixture.owner)
      .send({ text: 'Oi, sou a Carla.' })
      .expect(201);

    const paused = (await conversations(fixture))[0];

    expect(paused.mode).toBe('bot');
    expect(paused.botPausedUntil).not.toBeNull();
    expect(new Date(paused.botPausedUntil as string).getTime()).toBeGreaterThan(Date.now());

    const before = outbound().length;

    await deliver(envelope(textMessage('wamid.p2', 'Qual o horário?')));

    expect(outbound()).toHaveLength(before);

    await withAuth(http().post(`${base}/mode`), fixture.owner)
      .send({ mode: 'bot' })
      .expect(201);

    expect((await conversations(fixture))[0].botPausedUntil).toBeNull();

    await deliver(envelope(textMessage('wamid.p3', 'E o horário de sábado?')));

    expect(outbound()).toHaveLength(before + 1);
    expect(outbound()[before]).toMatchObject({ text: 'Atendemos de 9h às 18h.' });
  });

  it('fora do horário envia a mensagem de ausência', async () => {
    const fixture = await setup();

    await saveBot(fixture, {
      enabled: true,
      welcomeMessage: 'Olá!',
      hours: {
        enabled: true,
        timezone: 'UTC',
        days: [],
        holidays: [],
        awayMessage: 'Estamos fora do horário de atendimento.',
      },
    });

    await deliver(envelope(textMessage('wamid.f1', 'Bom dia')));

    expect(outbound()).toHaveLength(1);
    expect(outbound()[0]).toMatchObject({ text: 'Estamos fora do horário de atendimento.' });

    // Uma regra de "fora do horário" tem preferência sobre a mensagem padrão.
    await createRule(fixture, {
      name: 'Plantão',
      trigger: { kind: 'outsideHours' },
      reply: { kind: 'text', text: 'Plantão pelo 0800.' },
    });

    await deliver(envelope(textMessage('wamid.f2', 'Alguém aí?')));

    expect(outbound()[1]).toMatchObject({ text: 'Plantão pelo 0800.' });
  });

  it('IA desligada não responde; ligada responde pelo Grok e transfere quando não sabe', async () => {
    const fixture = await setup();

    await saveBot(fixture, { enabled: true, welcomeMessage: 'Olá!' });
    await deliver(envelope(textMessage('wamid.i1', 'Bom dia')));

    const before = outbound().length;

    await deliver(envelope(textMessage('wamid.i2', 'Vocês trabalham com integração?')));

    expect(outbound()).toHaveLength(before);

    await saveBot(fixture, {
      ai: {
        enabled: true,
        knowledgeBase: 'A Azuos Dev faz sistemas sob medida e integrações.',
        maxAnswerChars: 300,
      },
      handoffMessage: 'Vou chamar um atendente.',
    });

    provider().script({ content: 'Sim, fazemos integrações sob medida.' });
    await deliver(envelope(textMessage('wamid.i3', 'Vocês fazem integração?')));

    expect(outbound()[before]).toMatchObject({ text: 'Sim, fazemos integrações sob medida.' });

    provider().script({ content: 'TRANSFERIR' });
    await deliver(envelope(textMessage('wamid.i4', 'Quanto custa um sistema?')));

    expect(outbound()[before + 1]).toMatchObject({ text: 'Vou chamar um atendente.' });
    expect((await conversations(fixture))[0].mode).toBe('human');

    const usage = await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/ai/usage`),
      fixture.owner,
    ).expect(200);

    expect(usage.body.total).toBeGreaterThan(0);
  });

  it('respostas rápidas buscam pelo atalho e resolvem as variáveis', async () => {
    const fixture = await setup();
    const url = `/api/v1/workspaces/${fixture.workspace.id}/whatsapp/quick-replies`;

    await withAuth(http().post(url), fixture.owner)
      .send({ shortcut: 'ola', title: 'Saudação', text: 'Olá {nome}, tudo bem?' })
      .expect(201);

    const repeated = await withAuth(http().post(url), fixture.owner)
      .send({ shortcut: 'ola', title: 'Outra' })
      .expect(409);

    expect(repeated.body.code).toBe('WHATSAPP_QUICK_REPLY_EXISTS');

    await saveBot(fixture, { enabled: true, welcomeMessage: 'Olá!' });
    await deliver(envelope(textMessage('wamid.q1', 'Bom dia')));

    const [conversation] = await conversations(fixture);
    const found = await withAuth(
      http().get(`${url}?q=ol&conversationId=${conversation.id}`),
      fixture.ana,
    ).expect(200);

    expect(found.body.items).toHaveLength(1);
    expect(found.body.items[0]).toMatchObject({
      shortcut: 'ola',
      text: 'Olá {nome}, tudo bem?',
      rendered: 'Olá Ana Cliente, tudo bem?',
    });

    // Atendente lê, mas não escreve.
    await withAuth(http().post(url), fixture.ana)
      .send({ shortcut: 'tchau', title: 'Despedida' })
      .expect(403);
  });

  it('a visão geral conta status, dias, médias e o que o bot resolveu', async () => {
    const fixture = await setup();

    await saveBot(fixture, { enabled: true, welcomeMessage: 'Olá!' });

    await deliver(envelope(textMessage('wamid.m1', 'Bom dia')));
    await deliver(envelope(textMessage('wamid.m2', 'Oi', OTHER_CONTACT)));

    const list = await conversations(fixture);

    expect(list).toHaveLength(2);

    const ownerId = await userIdOf(fixture.owner);
    const [humanOne, botOne] = list;
    const humanBase = `/api/v1/workspaces/${fixture.workspace.id}/whatsapp/conversations/${humanOne.id}`;
    const botBase = `/api/v1/workspaces/${fixture.workspace.id}/whatsapp/conversations/${botOne.id}`;

    await withAuth(http().post(`${humanBase}/assign`), fixture.owner)
      .send({ assigneeId: ownerId })
      .expect(201);
    await withAuth(http().post(`${humanBase}/messages`), fixture.owner)
      .send({ text: 'Já verifico.' })
      .expect(201);
    await withAuth(http().post(`${humanBase}/close`), fixture.owner).expect(201);
    await withAuth(http().post(`${botBase}/close`), fixture.owner).expect(201);

    const overview = await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/whatsapp/overview`),
      fixture.owner,
    ).expect(200);

    expect(overview.body).toMatchObject({
      byStatus: { open: 0, waiting: 0, closed: 2 },
      conversations: 2,
      resolved: 2,
      botResolved: 1,
      botResolvedPercent: 50,
      truncated: false,
    });
    expect(overview.body.newPerDay.at(-1)).toMatchObject({ count: 2 });
    expect(overview.body.firstResponseAvgSeconds).toBeGreaterThanOrEqual(0);
    expect(overview.body.resolutionAvgSeconds).toBeGreaterThanOrEqual(0);

    const agent = (overview.body.byAgent as { userId: string; messages: number }[]).find(
      (one) => one.userId === ownerId,
    );

    expect(agent).toMatchObject({ conversations: 1, resolved: 1, messages: 1 });

    // Atendente não enxerga a visão geral, e o período inválido é recusado.
    await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/whatsapp/overview`),
      fixture.ana,
    ).expect(403);

    const invalid = await withAuth(
      http().get(
        `/api/v1/workspaces/${fixture.workspace.id}/whatsapp/overview?from=2026-11-10T00:00:00.000Z&to=2026-11-01T00:00:00.000Z`,
      ),
      fixture.owner,
    ).expect(400);

    expect(invalid.body.code).toBe('INVALID_PERIOD');
  });

  it('recusa regra sem valor e esconde o bot de quem não é gestor', async () => {
    const fixture = await setup();

    const refused = await withAuth(http().post(`${botUrl(fixture)}/rules`), fixture.owner)
      .send({ name: 'Sem valor', trigger: { kind: 'keyword' } })
      .expect(400);

    expect(refused.body.code).toBe('WHATSAPP_BOT_RULE_INVALID');

    const badRegex = await withAuth(http().post(`${botUrl(fixture)}/rules`), fixture.owner)
      .send({ name: 'Regex ruim', trigger: { kind: 'regex', value: '([' } })
      .expect(400);

    expect(badRegex.body.code).toBe('WHATSAPP_BOT_RULE_INVALID');

    const tooManyButtons = await withAuth(http().post(`${botUrl(fixture)}/rules`), fixture.owner)
      .send({
        name: 'Botões demais',
        trigger: { kind: 'keyword', value: 'menu' },
        reply: {
          kind: 'buttons',
          text: 'Escolha',
          options: [
            { id: '1', title: 'Um' },
            { id: '2', title: 'Dois' },
            { id: '3', title: 'Três' },
            { id: '4', title: 'Quatro' },
          ],
        },
      })
      .expect(400);

    expect(tooManyButtons.body.code).toBe('WHATSAPP_BOT_RULE_INVALID');

    const rule = await createRule(fixture, {
      name: 'Horário',
      trigger: { kind: 'keyword', value: 'horário' },
      reply: { kind: 'text', text: 'De 9h às 18h.' },
    });

    await withAuth(http().patch(`${botUrl(fixture)}/rules/${rule.id}`), fixture.owner)
      .send({ active: false, priority: 7 })
      .expect(200);

    const rules = await withAuth(http().get(`${botUrl(fixture)}/rules`), fixture.owner).expect(200);

    expect(rules.body.items[0]).toMatchObject({ priority: 7, active: false });

    await withAuth(http().delete(`${botUrl(fixture)}/rules/${rule.id}`), fixture.owner).expect(200);
    await withAuth(http().delete(`${botUrl(fixture)}/rules/${rule.id}`), fixture.owner).expect(404);

    // Atendente não chega nas configurações; quem não tem o módulo nem o vê.
    await withAuth(http().get(botUrl(fixture)), fixture.ana).expect(403);

    const hidden = await withAuth(http().get(botUrl(fixture)), fixture.outsider).expect(404);

    expect(hidden.body.code).toBe('WHATSAPP_NOT_FOUND');
  });
});
