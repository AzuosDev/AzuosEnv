import { Types } from 'mongoose';
import request from 'supertest';
import { AiAgentRunnerService } from '../src/modules/ai/ai-agent-runner.service';
import { AiAgentsService } from '../src/modules/ai/ai-agents.service';
import { AI_PROVIDER } from '../src/modules/ai/ai-provider';
import { StubAiProvider } from '../src/modules/ai/stub-ai.provider';
import { Session, createSession } from './utils/auth-client';
import { TestApp, createTestApp } from './utils/e2e-app';

interface IdBody {
  id: string;
}

interface TaskBody extends IdBody {
  customId: string;
  name: string;
}

interface MemberFixture {
  session: Session;
  userId: string;
}

interface Fixture {
  owner: Session;
  ownerId: string;
  member: MemberFixture;
  workspace: IdBody;
  space: IdBody;
  list: IdBody;
}

interface SseEvent {
  type: string;
  [key: string]: unknown;
}

describe('IA com Grok', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterEach(async () => {
    provider().reset();
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

  /** The suite always runs against the stub: nothing ever reaches the API of xAI. */
  function provider(): StubAiProvider {
    return ctx.app.get<StubAiProvider>(AI_PROVIDER);
  }

  function sseEvents(body: string): SseEvent[] {
    return body
      .split('\n\n')
      .map((block) => block.replace(/^data:\s*/, '').trim())
      .filter((block) => block.length > 0)
      .map((block) => JSON.parse(block) as SseEvent);
  }

  async function addMember(
    workspace: IdBody,
    owner: Session,
    role: 'admin' | 'member' | 'guest',
  ): Promise<MemberFixture> {
    const session = await createSession(ctx);
    const invite = await withAuth(http().post(`/api/v1/workspaces/${workspace.id}/invites`), owner)
      .send({ email: session.credentials.email, role })
      .expect(201);
    const accepted = await http()
      .post('/api/v1/invites/accept')
      .set('X-Forwarded-For', session.credentials.ip)
      .send({ token: invite.body.token })
      .expect(200);

    return { session, userId: accepted.body.member.userId as string };
  }

  async function setup(): Promise<Fixture> {
    const owner = await createSession(ctx);
    const me = await withAuth(http().get('/api/v1/auth/me'), owner).expect(200);
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
        .send({ spaceId: space.id, name: 'uSolutionsPDV' })
        .expect(201)
    ).body as IdBody;

    return {
      owner,
      ownerId: me.body.id as string,
      member: await addMember(workspace, owner, 'member'),
      workspace,
      space,
      list,
    };
  }

  async function createTask(
    fixture: Fixture,
    listId: string,
    body: Record<string, unknown>,
  ): Promise<TaskBody> {
    const response = await withAuth(
      http().post(`/api/v1/workspaces/${fixture.workspace.id}/lists/${listId}/tasks`),
      fixture.owner,
    )
      .send(body)
      .expect(201);

    return response.body as TaskBody;
  }

  /** A Space marked private is invisible to a member without an explicit share. */
  async function createPrivateList(fixture: Fixture): Promise<IdBody> {
    const space = (
      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/spaces`),
        fixture.owner,
      )
        .send({ name: 'Interno', private: true })
        .expect(201)
    ).body as IdBody;

    return (
      await withAuth(http().post(`/api/v1/workspaces/${fixture.workspace.id}/lists`), fixture.owner)
        .send({ spaceId: space.id, name: 'Sigiloso' })
        .expect(201)
    ).body as IdBody;
  }

  function chat(fixture: Fixture, body: Record<string, unknown>, session: Session): request.Test {
    return withAuth(
      http().post(`/api/v1/workspaces/${fixture.workspace.id}/ai/chat`),
      session,
    ).send(body);
  }

  describe('Chat com ferramentas', () => {
    it('roda a ferramenta no servidor e não mostra a tarefa que o usuário não vê', async () => {
      const fixture = await setup();
      const visible = await createTask(fixture, fixture.list.id, { name: 'Ajustar caixa aberto' });
      const privateList = await createPrivateList(fixture);
      const hidden = await createTask(fixture, privateList.id, { name: 'Ajustar caixa sigiloso' });

      provider().script(
        {
          content: '',
          toolCalls: [
            {
              id: 'call_1',
              name: 'search_tasks',
              arguments: JSON.stringify({ query: 'Ajustar caixa' }),
            },
          ],
        },
        { content: 'Encontrei uma tarefa com esse nome.' },
      );

      const response = await chat(
        fixture,
        { message: 'Quais tarefas falam de ajustar caixa?' },
        fixture.member.session,
      ).expect(200);

      expect(response.headers['content-type']).toContain('text/event-stream');

      const events = sseEvents(response.text);
      const tool = events.find((event) => event.type === 'tool');
      const items = (tool?.result as { items: TaskBody[] }).items;

      expect(tool?.name).toBe('search_tasks');
      expect(items.map((item) => item.customId)).toEqual([visible.customId]);
      expect(response.text).not.toContain(hidden.customId);
      expect(events.filter((event) => event.type === 'delta')).not.toHaveLength(0);

      const done = events.find((event) => event.type === 'done');

      expect(typeof done?.conversationId).toBe('string');
    });

    it('guarda a conversa e continua de onde parou', async () => {
      const fixture = await setup();
      const first = await chat(fixture, { message: 'Olá' }, fixture.owner).expect(200);
      const conversationId = sseEvents(first.text).find((event) => event.type === 'done')
        ?.conversationId as string;

      await chat(fixture, { message: 'E agora?', conversationId }, fixture.owner).expect(200);

      const stored = await ctx.connection
        .collection('ai_conversations')
        .findOne({ _id: new Types.ObjectId(conversationId) });

      expect((stored?.messages as unknown[]).length).toBeGreaterThanOrEqual(4);
    });

    it('recusa a conversa de outro usuário', async () => {
      const fixture = await setup();
      const first = await chat(fixture, { message: 'Olá' }, fixture.owner).expect(200);
      const conversationId = sseEvents(first.text).find((event) => event.type === 'done')
        ?.conversationId as string;

      await chat(fixture, { message: 'Oi', conversationId }, fixture.member.session).expect(404);
    });

    it('valida o corpo', async () => {
      const fixture = await setup();

      await chat(fixture, { message: '' }, fixture.owner).expect(400);
      await chat(fixture, { message: 'Oi', outro: 1 }, fixture.owner).expect(400);
    });
  });

  describe('Proteções', () => {
    it('responde 403 com o ClickApp de IA desligado', async () => {
      const fixture = await setup();

      await withAuth(http().patch(`/api/v1/workspaces/${fixture.workspace.id}`), fixture.owner)
        .send({ settings: { clickApps: { ai: false } } })
        .expect(200);

      const response = await chat(fixture, { message: 'Oi' }, fixture.owner).expect(403);

      expect(response.body.code).toBe('AI_DISABLED');
    });

    it('responde 429 quando o orçamento do mês acabou', async () => {
      const fixture = await setup();

      await ctx.connection.collection('ai_usage').insertOne({
        workspaceId: new Types.ObjectId(fixture.workspace.id),
        userId: null,
        feature: 'chat',
        tokensIn: 100_000,
        tokensOut: 1,
        model: 'grok-test',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await chat(fixture, { message: 'Oi' }, fixture.owner).expect(429);

      expect(response.body.code).toBe('AI_BUDGET_EXCEEDED');
    });

    it('registra o consumo e mostra o orçamento', async () => {
      const fixture = await setup();

      await chat(fixture, { message: 'Oi' }, fixture.owner).expect(200);

      const response = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/ai/usage`),
        fixture.owner,
      ).expect(200);

      expect(response.body.budget).toBe(100_000);
      expect(response.body.total).toBeGreaterThan(0);
    });
  });

  describe('Resumos', () => {
    it('resume a tarefa com os comentários', async () => {
      const fixture = await setup();
      const task = await createTask(fixture, fixture.list.id, { name: 'Fechamento de caixa' });

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${task.id}/comments`),
        fixture.owner,
      )
        .send({ bodyText: 'O cliente aprovou a correção.' })
        .expect(201);

      provider().script({ content: 'O cliente aprovou a correção do fechamento.' });

      const response = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/ai/summarize`),
        fixture.owner,
      )
        .send({ entityType: 'task', id: task.id })
        .expect(201);

      expect(response.body.summary).toContain('aprovou');
      expect(response.body.entityType).toBe('task');
    });

    it('resume o canal do chat', async () => {
      const fixture = await setup();
      const channel = (
        await withAuth(
          http().post(`/api/v1/workspaces/${fixture.workspace.id}/channels`),
          fixture.owner,
        )
          .send({ name: 'geral' })
          .expect(201)
      ).body as IdBody;

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/channels/${channel.id}/messages`),
        fixture.owner,
      )
        .send({ bodyText: 'Subimos a versão 2.4 em produção.' })
        .expect(201);

      const response = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/ai/summarize`),
        fixture.owner,
      )
        .send({ entityType: 'channel', id: channel.id })
        .expect(201);

      expect(response.body.summary).toContain('2.4');
    });

    it('não resume o que o usuário não vê e valida o tipo', async () => {
      const fixture = await setup();
      const privateList = await createPrivateList(fixture);
      const hidden = await createTask(fixture, privateList.id, { name: 'Sigiloso' });

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/ai/summarize`),
        fixture.member.session,
      )
        .send({ entityType: 'task', id: hidden.id })
        .expect(404);

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/ai/summarize`),
        fixture.owner,
      )
        .send({ entityType: 'planilha', id: hidden.id })
        .expect(400);
    });
  });

  describe('Tarefas a partir de um texto', () => {
    function propose(fixture: Fixture, text: string, session = fixture.owner): request.Test {
      return withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/ai/tasks-from-text`),
        session,
      ).send({ text, listId: fixture.list.id });
    }

    async function tasksOf(fixture: Fixture): Promise<TaskBody[]> {
      const response = await withAuth(
        http().get(
          `/api/v1/workspaces/${fixture.workspace.id}/tasks/query?location=list&locationId=${fixture.list.id}`,
        ),
        fixture.owner,
      ).expect(200);

      return response.body.items as TaskBody[];
    }

    it('propõe sem criar nada e cria só no confirm', async () => {
      const fixture = await setup();
      const proposal = await propose(
        fixture,
        'Corrigir o fechamento de caixa\nRevisar o relatório da Cênio',
      ).expect(201);

      expect(proposal.body.tasks).toHaveLength(2);
      expect(await tasksOf(fixture)).toHaveLength(0);

      const confirmed = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/ai/tasks-from-text/confirm`),
        fixture.owner,
      )
        .send({ listId: fixture.list.id, tasks: proposal.body.tasks })
        .expect(201);

      expect(confirmed.body.created).toHaveLength(2);
      expect((await tasksOf(fixture)).map((task) => task.name).sort()).toEqual([
        'Corrigir o fechamento de caixa',
        'Revisar o relatório da Cênio',
      ]);
    });

    it('recusa a proposta quando a IA não devolve tarefas', async () => {
      const fixture = await setup();

      provider().script({ content: '{"tasks":[]}' });

      const response = await propose(fixture, 'Qualquer coisa').expect(400);

      expect(response.body.code).toBe('AI_INVALID_PROPOSAL');
    });

    it('exige permissão de edição na List e valida o corpo', async () => {
      const fixture = await setup();
      const privateList = await createPrivateList(fixture);

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/ai/tasks-from-text`),
        fixture.member.session,
      )
        .send({ text: 'Fazer algo', listId: privateList.id })
        .expect(404);

      await propose(fixture, '').expect(400);
      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/ai/tasks-from-text/confirm`),
        fixture.owner,
      )
        .send({ listId: fixture.list.id, tasks: [{ name: '' }] })
        .expect(400);
    });
  });

  describe('Reescrita de texto', () => {
    it('devolve o texto reescrito', async () => {
      const fixture = await setup();

      provider().script({ content: 'Corrigir o fechamento de caixa do PDV.' });

      const response = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/ai/write`),
        fixture.owner,
      )
        .send({ action: 'improve', text: 'corrige ai o fechamento de caixa do pdv' })
        .expect(201);

      expect(response.body).toEqual({
        action: 'improve',
        text: 'Corrigir o fechamento de caixa do PDV.',
      });
    });

    it('valida a ação', async () => {
      const fixture = await setup();

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/ai/write`),
        fixture.owner,
      )
        .send({ action: 'rhyme', text: 'oi' })
        .expect(400);
    });
  });

  describe('Agentes agendados', () => {
    function createAgent(
      fixture: Fixture,
      body: Record<string, unknown> = {},
      session = fixture.owner,
    ): request.Test {
      return withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/ai/agents`),
        session,
      ).send({ name: 'Resumo diário', type: 'dailySummary', cron: '0 8 * * 1-5', ...body });
    }

    it('cria, lista e remove o agente', async () => {
      const fixture = await setup();
      const agent = (await createAgent(fixture).expect(201)).body as IdBody;
      const list = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/ai/agents`),
        fixture.owner,
      ).expect(200);

      expect(list.body.items).toHaveLength(1);

      await withAuth(
        http().patch(`/api/v1/workspaces/${fixture.workspace.id}/ai/agents/${agent.id}`),
        fixture.owner,
      )
        .send({ active: false })
        .expect(200);

      await withAuth(
        http().delete(`/api/v1/workspaces/${fixture.workspace.id}/ai/agents/${agent.id}`),
        fixture.owner,
      ).expect(200);

      await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/ai/agents/${agent.id}`),
        fixture.owner,
      ).expect(404);
    });

    it('exige admin e um cron válido', async () => {
      const fixture = await setup();

      await createAgent(fixture, {}, fixture.member.session).expect(403);

      const invalid = await createAgent(fixture, { cron: 'todo dia de manhã' }).expect(400);

      expect(invalid.body.code).toBe('INVALID_AI_AGENT');
    });

    it('entrega o resumo diário no Inbox de quem criou', async () => {
      const fixture = await setup();

      await createTask(fixture, fixture.list.id, {
        name: 'Tarefa atrasada',
        dueAt: new Date(Date.now() - 86_400_000).toISOString(),
      });

      const created = (await createAgent(fixture).expect(201)).body as IdBody;
      const agents = ctx.app.get(AiAgentsService);
      const runner = ctx.app.get(AiAgentRunnerService);

      provider().script({ content: '- AZD-1 Tarefa atrasada está vencida.' });

      const agent = await agents.get(
        {
          workspaceId: new Types.ObjectId(fixture.workspace.id),
          userId: new Types.ObjectId(fixture.ownerId),
          role: 'owner',
        },
        new Types.ObjectId(created.id),
      );
      const result = await runner.run(agent);

      expect(result.delivered).toBe('inbox');

      const inbox = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/inbox?tab=primary`),
        fixture.owner,
      ).expect(200);

      const entry = (inbox.body.items as { type: string; data: { text: string } }[]).find(
        (item) => item.type === 'aiSummary',
      );

      expect(entry?.data.text).toContain('Tarefa atrasada');
    });

    it('posta o resumo no canal configurado', async () => {
      const fixture = await setup();
      const channel = (
        await withAuth(
          http().post(`/api/v1/workspaces/${fixture.workspace.id}/channels`),
          fixture.owner,
        )
          .send({ name: 'resumos' })
          .expect(201)
      ).body as IdBody;
      const created = (
        await createAgent(fixture, {
          type: 'overdueDigest',
          config: { channelId: channel.id },
        }).expect(201)
      ).body as IdBody;

      provider().script({ content: 'Nenhuma tarefa atrasada.' });

      const agents = ctx.app.get(AiAgentsService);
      const agent = await agents.get(
        {
          workspaceId: new Types.ObjectId(fixture.workspace.id),
          userId: new Types.ObjectId(fixture.ownerId),
          role: 'owner',
        },
        new Types.ObjectId(created.id),
      );

      expect((await ctx.app.get(AiAgentRunnerService).run(agent)).delivered).toBe('channel');

      const messages = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/channels/${channel.id}/messages`),
        fixture.owner,
      ).expect(200);

      expect((messages.body.items as { bodyText: string }[])[0].bodyText).toContain(
        'Nenhuma tarefa atrasada.',
      );
    });
  });
});
