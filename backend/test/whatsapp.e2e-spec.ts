import request from 'supertest';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  WaOutbound,
  WaTemplate,
  WaUploadInput,
  WhatsappGraphProvider,
} from '../src/modules/whatsapp/graph/whatsapp-graph.provider';
import { WaMessage } from '../src/modules/whatsapp/schemas/wa-message.schema';
import { WhatsappWebhookService } from '../src/modules/whatsapp/whatsapp-webhook.service';
import { signBody } from '../src/modules/integrations/webhooks/webhook-signature';
import { Session, createSession } from './utils/auth-client';
import { TestApp, createTestApp } from './utils/e2e-app';

interface IdBody {
  id: string;
}

interface ConversationBody extends IdBody {
  status: 'open' | 'waiting' | 'closed';
  assigneeId: string | null;
  priority: string;
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

interface Fixture {
  owner: Session;
  /** Attendant the conversation gets assigned to. */
  ana: Session;
  anaId: string;
  /** Second attendant, who must not see the conversation of Ana. */
  bruno: Session;
  /** Member with no access to the module. */
  outsider: Session;
  workspace: IdBody;
  list: IdBody;
}

const PHONE_NUMBER_ID = '1098765';
const APP_SECRET = 'segredo-do-app-de-teste';
const VERIFY_TOKEN = 'token-de-verificacao';
const CONTACT = '5531999990000';

/** WhatsApp Cloud API scripted by each test; nothing leaves the process. */
const fakeGraph = {
  sent: [] as WaOutbound[],
  uploaded: [] as WaUploadInput[],
  downloads: [] as string[],
  reads: [] as string[],
  templateList: [] as WaTemplate[],
  send: (_credentials: unknown, message: WaOutbound): Promise<string> => {
    fakeGraph.sent.push(message);

    return Promise.resolve(`wamid.out.${fakeGraph.sent.length}`);
  },
  upload: (_credentials: unknown, file: WaUploadInput): Promise<string> => {
    fakeGraph.uploaded.push(file);

    return Promise.resolve('media-enviada');
  },
  mediaInfo: (_credentials: unknown, mediaId: string) =>
    Promise.resolve({ url: `https://fake.graph/${mediaId}`, mime: 'image/jpeg', size: 9 }),
  download: (_credentials: unknown, url: string) => {
    fakeGraph.downloads.push(url);

    return Promise.resolve({ buffer: Buffer.from('conteudo'), mime: 'image/jpeg' });
  },
  markRead: (_credentials: unknown, waMessageId: string): Promise<void> => {
    fakeGraph.reads.push(waMessageId);

    return Promise.resolve();
  },
  templates: (): Promise<WaTemplate[]> => Promise.resolve(fakeGraph.templateList),
  phoneInfo: () =>
    Promise.resolve({
      displayPhone: '+55 31 99999-0000',
      verifiedName: 'Azuos Dev',
      qualityRating: 'GREEN',
    }),
};

describe('WhatsApp', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp({
      overrides: [{ token: WhatsappGraphProvider, value: fakeGraph }],
    });
  });

  beforeEach(() => {
    fakeGraph.sent = [];
    fakeGraph.uploaded = [];
    fakeGraph.downloads = [];
    fakeGraph.reads = [];
    fakeGraph.templateList = [
      {
        name: 'retorno_atendimento',
        language: 'pt_BR',
        status: 'APPROVED',
        category: 'UTILITY',
        variables: 1,
      },
    ];
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
    const space = (
      await withAuth(http().post(`/api/v1/workspaces/${workspace.id}/spaces`), owner)
        .send({ name: 'Clientes' })
        .expect(201)
    ).body as IdBody;
    const list = (
      await withAuth(http().post(`/api/v1/workspaces/${workspace.id}/lists`), owner)
        .send({ spaceId: space.id, name: 'Atendimento' })
        .expect(201)
    ).body as IdBody;
    const ana = await addMember(workspace, owner);
    const bruno = await addMember(workspace, owner);
    const outsider = await addMember(workspace, owner);
    const anaId = await userIdOf(ana);

    for (const [session, level] of [
      [ana, 'atendente'],
      [bruno, 'atendente'],
    ] as const) {
      await withAuth(
        http().put(`/api/v1/workspaces/${workspace.id}/whatsapp/access/${await userIdOf(session)}`),
        owner,
      )
        .send({ level })
        .expect(200);
    }

    await withAuth(http().put(`/api/v1/workspaces/${workspace.id}/whatsapp/connection`), owner)
      .send({
        phoneNumberId: PHONE_NUMBER_ID,
        wabaId: '555000',
        accessToken: 'token-da-graph',
        appSecret: APP_SECRET,
        verifyToken: VERIFY_TOKEN,
      })
      .expect(200);

    return { owner, ana, anaId, bruno, outsider, workspace, list };
  }

  /** Envelope of the Cloud API with one `changes[].value`. */
  function envelope(value: Record<string, unknown>): string {
    return JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '555000',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '5531999990000',
                  phone_number_id: PHONE_NUMBER_ID,
                },
                ...value,
              },
            },
          ],
        },
      ],
    });
  }

  function textMessage(id: string, secondsAgo = 60): Record<string, unknown> {
    return {
      contacts: [{ wa_id: CONTACT, profile: { name: 'Ana Cliente' } }],
      messages: [
        {
          id,
          from: CONTACT,
          timestamp: String(Math.floor((Date.now() - secondsAgo * 1000) / 1000)),
          type: 'text',
          text: { body: 'Bom dia, preciso de ajuda' },
        },
      ],
    };
  }

  /** Posts a signed delivery and waits for the asynchronous processing. */
  async function deliver(payload: string, secret = APP_SECRET): Promise<request.Response> {
    const response = await http()
      .post('/api/v1/integrations/whatsapp/webhook')
      .set('X-Forwarded-For', '10.90.0.1')
      .set('content-type', 'application/json')
      .set('X-Hub-Signature-256', signBody(payload, secret))
      .send(payload);

    if (response.status === 200) {
      await ctx.app.get(WhatsappWebhookService).settle();
    }

    return response;
  }

  async function conversations(
    fixture: Fixture,
    session: Session,
    query = 'filter=all',
  ): Promise<ConversationBody[]> {
    const response = await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/whatsapp/conversations?${query}`),
      session,
    ).expect(200);

    return response.body.items as ConversationBody[];
  }

  async function messagesOf(
    fixture: Fixture,
    session: Session,
    conversationId: string,
  ): Promise<MessageBody[]> {
    const response = await withAuth(
      http().get(
        `/api/v1/workspaces/${fixture.workspace.id}/whatsapp/conversations/${conversationId}/messages`,
      ),
      session,
    ).expect(200);

    return response.body.items as MessageBody[];
  }

  it('responde o desafio da verificação e recusa o token errado', async () => {
    await setup();

    const ok = await http()
      .get('/api/v1/integrations/whatsapp/webhook')
      .set('X-Forwarded-For', '10.90.1.1')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': VERIFY_TOKEN, 'hub.challenge': '4242' })
      .expect(200);

    expect(ok.text).toBe('4242');

    await http()
      .get('/api/v1/integrations/whatsapp/webhook')
      .set('X-Forwarded-For', '10.90.1.2')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'errado', 'hub.challenge': '1' })
      .expect(403);
  });

  it('recusa assinatura inválida com 401', async () => {
    await setup();

    const response = await deliver(envelope(textMessage('wamid.assinatura')), 'outro-segredo');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('INVALID_SIGNATURE');
  });

  it('cria conversa, contato e mensagem; a entrega repetida não duplica', async () => {
    const fixture = await setup();

    await deliver(envelope(textMessage('wamid.1'))).then((response) =>
      expect(response.status).toBe(200),
    );
    await deliver(envelope(textMessage('wamid.1'))).then((response) =>
      expect(response.status).toBe(200),
    );

    const list = await conversations(fixture, fixture.owner);

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ status: 'open', unreadCount: 1, assigneeId: null });

    const messages = await messagesOf(fixture, fixture.owner, list[0].id);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      waMessageId: 'wamid.1',
      direction: 'inbound',
      type: 'text',
      body: 'Bom dia, preciso de ajuda',
    });

    const contacts = await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/whatsapp/contacts`),
      fixture.owner,
    ).expect(200);

    expect(contacts.body.items).toHaveLength(1);
    expect(contacts.body.items[0]).toMatchObject({ waId: CONTACT, profileName: 'Ana Cliente' });
  });

  it('baixa a mídia recebida pela Graph API e guarda no storage', async () => {
    const fixture = await setup();

    await deliver(
      envelope({
        contacts: [{ wa_id: CONTACT, profile: { name: 'Ana Cliente' } }],
        messages: [
          {
            id: 'wamid.img',
            from: CONTACT,
            timestamp: String(Math.floor(Date.now() / 1000)),
            type: 'image',
            image: { id: 'media-7', mime_type: 'image/jpeg', caption: 'Comprovante' },
          },
        ],
      }),
    ).then((response) => expect(response.status).toBe(200));

    expect(fakeGraph.downloads).toEqual(['https://fake.graph/media-7']);

    const [conversation] = await conversations(fixture, fixture.owner);
    const [message] = await messagesOf(fixture, fixture.owner, conversation.id);

    expect(message).toMatchObject({ type: 'image', body: 'Comprovante' });
    expect(message.media).toMatchObject({ mime: 'image/jpeg', size: 8 });

    const model = ctx.app.get<Model<WaMessage>>(getModelToken(WaMessage.name));
    const stored = await model
      .findOne({ waMessageId: 'wamid.img' })
      .select('+media.storageKey')
      .exec();

    expect(stored?.media?.storageKey).toContain('/');
  });

  it('atualiza o status da mensagem enviada e guarda o erro do failed', async () => {
    const fixture = await setup();

    await deliver(envelope(textMessage('wamid.1'))).then((r) => expect(r.status).toBe(200));

    const [conversation] = await conversations(fixture, fixture.owner);
    const sent = await withAuth(
      http().post(
        `/api/v1/workspaces/${fixture.workspace.id}/whatsapp/conversations/${conversation.id}/messages`,
      ),
      fixture.owner,
    )
      .send({ text: 'Bom dia! Já verifico.' })
      .expect(201);

    expect(sent.body).toMatchObject({ direction: 'outbound', status: 'sent' });
    expect(fakeGraph.sent[0]).toMatchObject({ to: CONTACT, type: 'text' });

    const waMessageId = sent.body.waMessageId as string;

    await deliver(
      envelope({ statuses: [{ id: waMessageId, status: 'read', timestamp: '1700000500' }] }),
    ).then((r) => expect(r.status).toBe(200));

    const afterRead = await messagesOf(fixture, fixture.owner, conversation.id);

    expect(afterRead.find((message) => message.waMessageId === waMessageId)?.status).toBe('read');

    await deliver(
      envelope({
        statuses: [
          {
            id: waMessageId,
            status: 'failed',
            timestamp: '1700000600',
            errors: [{ code: 131047, title: 'Re-engagement', message: 'Janela fechada' }],
          },
        ],
      }),
    ).then((r) => expect(r.status).toBe(200));

    const afterFail = await messagesOf(fixture, fixture.owner, conversation.id);

    expect(afterFail.find((message) => message.waMessageId === waMessageId)?.status).toBe('failed');
  });

  it('atendente não vê a conversa de outro atendente', async () => {
    const fixture = await setup();

    await deliver(envelope(textMessage('wamid.1'))).then((r) => expect(r.status).toBe(200));

    const [conversation] = await conversations(fixture, fixture.owner);

    await withAuth(
      http().post(
        `/api/v1/workspaces/${fixture.workspace.id}/whatsapp/conversations/${conversation.id}/assign`,
      ),
      fixture.owner,
    )
      .send({ assigneeId: fixture.anaId })
      .expect(201);

    expect(await conversations(fixture, fixture.ana)).toHaveLength(1);
    expect(await conversations(fixture, fixture.bruno)).toHaveLength(0);

    await withAuth(
      http().get(
        `/api/v1/workspaces/${fixture.workspace.id}/whatsapp/conversations/${conversation.id}`,
      ),
      fixture.bruno,
    ).expect(404);

    // O atendente também não assume a conversa para outra pessoa.
    const brunoId = await userIdOf(fixture.bruno);
    const refused = await withAuth(
      http().post(
        `/api/v1/workspaces/${fixture.workspace.id}/whatsapp/conversations/${conversation.id}/assign`,
      ),
      fixture.ana,
    )
      .send({ assigneeId: brunoId })
      .expect(400);

    expect(refused.body.code).toBe('WHATSAPP_ASSIGNEE_NOT_ALLOWED');
  });

  it('membro sem acesso ao módulo recebe 404 em tudo', async () => {
    const fixture = await setup();

    const list = await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/whatsapp/conversations`),
      fixture.outsider,
    ).expect(404);

    expect(list.body.code).toBe('WHATSAPP_NOT_FOUND');

    await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/whatsapp/connection`),
      fixture.outsider,
    ).expect(404);

    await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/whatsapp/contacts`),
      fixture.outsider,
    ).expect(404);

    // Atendente não mexe em contatos nem na conexão (nível insuficiente).
    await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/whatsapp/contacts`),
      fixture.ana,
    ).expect(403);

    await withAuth(
      http().put(`/api/v1/workspaces/${fixture.workspace.id}/whatsapp/connection`),
      fixture.ana,
    )
      .send({
        phoneNumberId: PHONE_NUMBER_ID,
        wabaId: '1',
        accessToken: 'x',
        appSecret: 'y',
        verifyToken: 'z'.repeat(10),
      })
      .expect(403);
  });

  it('fora da janela de 24 h só o template passa', async () => {
    const fixture = await setup();

    await deliver(envelope(textMessage('wamid.antigo', 48 * 60 * 60))).then((r) =>
      expect(r.status).toBe(200),
    );

    const [conversation] = await conversations(fixture, fixture.owner);
    const base = `/api/v1/workspaces/${fixture.workspace.id}/whatsapp/conversations/${conversation.id}`;
    const refused = await withAuth(http().post(`${base}/messages`), fixture.owner)
      .send({ text: 'Oi, tudo bem?' })
      .expect(409);

    expect(refused.body.code).toBe('WINDOW_CLOSED');
    expect(fakeGraph.sent).toHaveLength(0);

    const templates = await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/whatsapp/templates`),
      fixture.owner,
    ).expect(200);

    expect(templates.body.items[0]).toMatchObject({ name: 'retorno_atendimento' });

    const sent = await withAuth(http().post(`${base}/messages/template`), fixture.owner)
      .send({ name: 'retorno_atendimento', language: 'pt_BR', variables: ['Ana'] })
      .expect(201);

    expect(sent.body).toMatchObject({ type: 'template', direction: 'outbound', status: 'sent' });
    expect(fakeGraph.sent[0]).toMatchObject({
      type: 'template',
      template: { name: 'retorno_atendimento', language: 'pt_BR', variables: ['Ana'] },
    });
  });

  it('envia mídia pela Graph API e marca a conversa como lida', async () => {
    const fixture = await setup();

    await deliver(envelope(textMessage('wamid.1'))).then((r) => expect(r.status).toBe(200));

    const [conversation] = await conversations(fixture, fixture.owner);
    const base = `/api/v1/workspaces/${fixture.workspace.id}/whatsapp/conversations/${conversation.id}`;
    const sent = await withAuth(http().post(`${base}/messages/media`), fixture.owner)
      .field('caption', 'Segue o contrato')
      .attach('file', Buffer.from('%PDF-1.4 teste'), {
        filename: 'contrato.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    expect(sent.body).toMatchObject({ type: 'document', direction: 'outbound' });
    expect(fakeGraph.uploaded[0]).toMatchObject({ filename: 'contrato.pdf' });

    const read = await withAuth(http().post(`${base}/read`), fixture.owner).expect(201);

    expect(read.body.unreadCount).toBe(0);
    expect(fakeGraph.reads).toEqual(['wamid.1']);
  });

  it('vira tarefa e vira lead em Comercial › Leads', async () => {
    const fixture = await setup();

    await deliver(envelope(textMessage('wamid.1'))).then((r) => expect(r.status).toBe(200));

    const [conversation] = await conversations(fixture, fixture.owner);
    const base = `/api/v1/workspaces/${fixture.workspace.id}/whatsapp/conversations/${conversation.id}`;
    const task = await withAuth(http().post(`${base}/task`), fixture.owner)
      .send({ listId: fixture.list.id, name: 'Atender Ana' })
      .expect(201);

    expect(task.body).toMatchObject({ name: 'Atender Ana', listId: fixture.list.id });
    expect(task.body.descriptionText).toContain(CONTACT);

    const lead = await withAuth(http().post(`${base}/lead`), fixture.owner)
      .send({})
      .expect(201);

    expect(lead.body.name).toContain('Ana Cliente');

    const tree = await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/spaces`),
      fixture.owner,
    ).expect(200);

    expect(
      (tree.body.items as { name: string }[]).some((space) => space.name === 'Comercial'),
    ).toBe(true);
  });

  it('finaliza, reabre e filtra as conversas', async () => {
    const fixture = await setup();

    await deliver(envelope(textMessage('wamid.1'))).then((r) => expect(r.status).toBe(200));

    const [conversation] = await conversations(fixture, fixture.owner);
    const base = `/api/v1/workspaces/${fixture.workspace.id}/whatsapp/conversations/${conversation.id}`;

    await withAuth(http().post(`${base}/priority`), fixture.owner)
      .send({ priority: 'urgent' })
      .expect(201);

    expect(await conversations(fixture, fixture.owner, 'filter=priority')).toHaveLength(1);

    await withAuth(http().post(`${base}/close`), fixture.owner).expect(201);

    expect(await conversations(fixture, fixture.owner, 'filter=open')).toHaveLength(0);
    expect(await conversations(fixture, fixture.owner, 'filter=closed')).toHaveLength(1);

    await withAuth(http().post(`${base}/reopen`), fixture.owner).expect(201);

    expect(await conversations(fixture, fixture.owner, 'filter=open')).toHaveLength(1);
    expect(await conversations(fixture, fixture.owner, 'q=Ana')).toHaveLength(1);
    expect(await conversations(fixture, fixture.owner, 'q=inexistente')).toHaveLength(0);
  });

  it('lista e troca o acesso ao módulo', async () => {
    const fixture = await setup();

    const listed = await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/whatsapp/access`),
      fixture.owner,
    ).expect(200);
    const ana = (listed.body.items as { userId: string; level: string | null }[]).find(
      (entry) => entry.userId === fixture.anaId,
    );

    expect(ana?.level).toBe('atendente');
    expect((listed.body.items as { fromRole: boolean }[]).some((entry) => entry.fromRole)).toBe(
      true,
    );

    await withAuth(
      http().put(`/api/v1/workspaces/${fixture.workspace.id}/whatsapp/access/${fixture.anaId}`),
      fixture.owner,
    )
      .send({ level: 'supervisor' })
      .expect(200);

    const me = await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/whatsapp/access/me`),
      fixture.ana,
    ).expect(200);

    expect(me.body.level).toBe('supervisor');

    await withAuth(
      http().delete(`/api/v1/workspaces/${fixture.workspace.id}/whatsapp/access/${fixture.anaId}`),
      fixture.owner,
    ).expect(200);

    await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/whatsapp/conversations`),
      fixture.ana,
    ).expect(404);
  });
});
