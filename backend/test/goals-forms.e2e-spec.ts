import request from 'supertest';
import { Session, createSession, nextIp } from './utils/auth-client';
import { TestApp, createTestApp } from './utils/e2e-app';

interface IdBody {
  id: string;
}

interface StatusBody {
  id: string;
  name: string;
  group: 'notStarted' | 'active' | 'done' | 'closed';
}

interface TaskBody {
  id: string;
  customId: string;
  name: string;
  descriptionText: string;
  priority: string | null;
  dueAt: string | null;
  assigneeIds: string[];
  customFields: { fieldId: string; value: unknown }[];
}

interface TargetBody {
  id: string;
  type: string;
  start: number;
  target: number;
  current: number;
}

interface GoalViewBody {
  goal: IdBody & { name: string; private: boolean };
  targets: TargetBody[];
  progress: number;
}

interface FormBody extends IdBody {
  title: string;
  active: boolean;
  fields: { id: string; label: string; mapTo?: string | null }[];
  publicTokenHash?: string;
}

interface FormResultBody {
  form: FormBody;
  token: string;
  url: string;
}

interface MemberFixture {
  session: Session;
  userId: string;
}

interface Fixture {
  owner: Session;
  ownerId: string;
  member: MemberFixture;
  guest: Session;
  workspace: IdBody;
  space: IdBody;
  list: IdBody;
  statuses: StatusBody[];
  customFieldId: string;
}

describe('Metas e formulários públicos', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
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

  /** The listeners and the automations run detached, so the assertions wait. */
  async function waitFor<T>(probe: () => Promise<T | null>, timeoutMs = 15000): Promise<T> {
    const deadline = Date.now() + timeoutMs;

    for (;;) {
      const found = await probe();

      if (found !== null) {
        return found;
      }

      if (Date.now() >= deadline) {
        throw new Error('O evento não terminou no tempo esperado.');
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }
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
        .send({ name: 'Comercial' })
        .expect(201)
    ).body as IdBody;
    const list = (
      await withAuth(http().post(`/api/v1/workspaces/${workspace.id}/lists`), owner)
        .send({ spaceId: space.id, name: 'Leads' })
        .expect(201)
    ).body as IdBody;
    const statuses = (
      await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/lists/${list.id}/statuses`),
        owner,
      ).expect(200)
    ).body.statuses as StatusBody[];
    const customField = await withAuth(
      http().post(`/api/v1/workspaces/${workspace.id}/custom-fields`),
      owner,
    )
      .send({ scope: 'list', scopeId: list.id, name: 'Ambiente', type: 'text' })
      .expect(201);

    return {
      owner,
      ownerId: me.body.id as string,
      member: await addMember(workspace, owner, 'member'),
      guest: (await addMember(workspace, owner, 'guest')).session,
      workspace,
      space,
      list,
      statuses,
      customFieldId: customField.body.id as string,
    };
  }

  async function createTask(fixture: Fixture, name: string): Promise<TaskBody> {
    const response = await withAuth(
      http().post(`/api/v1/workspaces/${fixture.workspace.id}/lists/${fixture.list.id}/tasks`),
      fixture.owner,
    )
      .send({ name })
      .expect(201);

    return response.body as TaskBody;
  }

  function doneStatus(fixture: Fixture): StatusBody {
    const status = fixture.statuses.find((one) => one.group === 'done');

    if (!status) {
      throw new Error('O conjunto de status não tem um status do grupo done.');
    }

    return status;
  }

  describe('Metas e alvos', () => {
    function createGoal(
      fixture: Fixture,
      body: Record<string, unknown> = {},
      session = fixture.owner,
    ): request.Test {
      return withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/goals`),
        session,
      ).send({ name: 'Entregar o PDV da Cênio', ...body });
    }

    async function goalOf(fixture: Fixture, goalId: string): Promise<GoalViewBody> {
      const response = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/goals/${goalId}`),
        fixture.owner,
      ).expect(200);

      return response.body as GoalViewBody;
    }

    it('guarda a meta na pasta e devolve o progresso dos alvos', async () => {
      const fixture = await setup();
      const folder = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/goal-folders`),
        fixture.owner,
      )
        .send({ name: 'Metas 2026' })
        .expect(201);
      const goal = (await createGoal(fixture, { folderId: folder.body.id }).expect(201))
        .body as IdBody;

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/goals/${goal.id}/targets`),
        fixture.owner,
      )
        .send({ name: 'Faturamento', type: 'currency', start: 1000, target: 5000, current: 3000 })
        .expect(201);

      const view = await goalOf(fixture, goal.id);

      expect(view.progress).toBe(50);
      expect(view.targets).toHaveLength(1);

      const list = await withAuth(
        http()
          .get(`/api/v1/workspaces/${fixture.workspace.id}/goals`)
          .query({ folderId: folder.body.id }),
        fixture.owner,
      ).expect(200);

      expect(list.body.items.map((one: GoalViewBody) => one.goal.id)).toEqual([goal.id]);
    });

    it('o alvo do tipo tasks avança ao fechar a tarefa', async () => {
      const fixture = await setup();
      const first = await createTask(fixture, 'Instalar o PDV');
      const second = await createTask(fixture, 'Treinar a equipe');
      const goal = (await createGoal(fixture).expect(201)).body as IdBody;
      const created = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/goals/${goal.id}/targets`),
        fixture.owner,
      )
        .send({ name: 'Tarefas entregues', type: 'tasks', taskIds: [first.id, second.id] })
        .expect(201);

      expect(created.body.target.target).toBe(2);
      expect(created.body.target.current).toBe(0);
      expect(created.body.progress).toBe(0);

      await withAuth(
        http().patch(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${first.id}`),
        fixture.owner,
      )
        .send({ statusId: doneStatus(fixture).id })
        .expect(200);

      const advanced = await waitFor(async () => {
        const view = await goalOf(fixture, goal.id);

        return view.progress === 50 ? view : null;
      });

      expect(advanced.targets[0].current).toBe(1);
      expect(advanced.targets[0].target).toBe(2);
    });

    it('grava o valor do alvo de número no PATCH', async () => {
      const fixture = await setup();
      const goal = (await createGoal(fixture).expect(201)).body as IdBody;
      const created = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/goals/${goal.id}/targets`),
        fixture.owner,
      )
        .send({ name: 'Horas', type: 'number', start: 0, target: 10, current: 0 })
        .expect(201);
      const targetId = (created.body.target as IdBody).id;

      const patched = await withAuth(
        http().patch(
          `/api/v1/workspaces/${fixture.workspace.id}/goals/${goal.id}/targets/${targetId}`,
        ),
        fixture.owner,
      )
        .send({ current: 5 })
        .expect(200);

      expect(patched.body.target.current).toBe(5);
      expect(patched.body.progress).toBe(50);

      // O valor fica gravado: o GET da meta devolve o mesmo número.
      const view = await goalOf(fixture, goal.id);

      expect(view.targets[0].current).toBe(5);
      expect(view.progress).toBe(50);
    });

    it('recusa o alvo sem valor e sem escopo de tarefas', async () => {
      const fixture = await setup();
      const goal = (await createGoal(fixture).expect(201)).body as IdBody;
      const url = `/api/v1/workspaces/${fixture.workspace.id}/goals/${goal.id}/targets`;

      const noValue = await withAuth(http().post(url), fixture.owner)
        .send({ name: 'Horas', type: 'number' })
        .expect(400);

      expect(noValue.body.code).toBe('INVALID_TARGET');

      const noScope = await withAuth(http().post(url), fixture.owner)
        .send({ name: 'Tarefas', type: 'tasks' })
        .expect(400);

      expect(noScope.body.code).toBe('INVALID_TARGET');
    });

    it('esconde a meta privada de outro membro e barra o convidado', async () => {
      const fixture = await setup();
      const goal = (await createGoal(fixture, { private: true }).expect(201)).body as IdBody;

      const denied = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/goals/${goal.id}`),
        fixture.member.session,
      ).expect(404);

      expect(denied.body.code).toBe('GOAL_NOT_FOUND');

      const forbidden = await createGoal(fixture, {}, fixture.guest).expect(403);

      expect(forbidden.body.code).toBe('FORBIDDEN_ROLE');
    });
  });

  describe('Formulários públicos', () => {
    function formPayload(fixture: Fixture): Record<string, unknown> {
      return {
        listId: fixture.list.id,
        title: 'Abrir chamado',
        description: 'Fale com o time da Azuos Dev.',
        fields: [
          { id: 'nome', label: 'Assunto', type: 'text', required: true, mapTo: 'name' },
          { id: 'detalhe', label: 'Detalhe', type: 'longText', mapTo: 'description' },
          {
            id: 'prioridade',
            label: 'Prioridade',
            type: 'dropdown',
            options: [
              { id: 'urgent', label: 'Urgente' },
              { id: 'normal', label: 'Normal' },
            ],
            mapTo: 'priority',
          },
          { id: 'prazo', label: 'Prazo', type: 'date', mapTo: 'dueAt' },
          {
            id: 'ambiente',
            label: 'Ambiente',
            type: 'text',
            mapTo: `customField:${fixture.customFieldId}`,
          },
          { id: 'extra', label: 'Observação', type: 'text' },
        ],
        conditions: [{ fieldId: 'prioridade', op: 'eq', value: 'urgent', showFieldIds: ['prazo'] }],
        defaultAssigneeId: fixture.member.userId,
        notify: [fixture.member.userId],
      };
    }

    async function createForm(fixture: Fixture): Promise<FormResultBody> {
      const response = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/forms`),
        fixture.owner,
      )
        .send(formPayload(fixture))
        .expect(201);

      return response.body as FormResultBody;
    }

    function submit(token: string, body: Record<string, unknown>, ip = nextIp()): request.Test {
      return http()
        .post(`/api/v1/public/forms/${token}/submit`)
        .set('X-Forwarded-For', ip)
        .send(body);
    }

    it('cria o formulário e devolve o token público uma única vez', async () => {
      const fixture = await setup();
      const created = await createForm(fixture);

      expect(created.token).toHaveLength(43);
      expect(created.url).toContain(`/public/forms/${created.token}`);
      expect(created.form.publicTokenHash).toBeUndefined();

      const read = await http()
        .get(`/api/v1/public/forms/${created.token}`)
        .set('X-Forwarded-For', nextIp())
        .expect(200);

      expect(read.body.title).toBe('Abrir chamado');
      expect(read.body.fields).toHaveLength(6);
      expect(read.body.fields[0].mapTo).toBeUndefined();

      await http()
        .get('/api/v1/public/forms/token-errado')
        .set('X-Forwarded-For', nextIp())
        .expect(404);
    });

    it('cria a tarefa mapeada, avisa o time e dispara a automação formSubmitted', async () => {
      const fixture = await setup();
      const automation = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/automations`),
        fixture.owner,
      )
        .send({
          locationType: 'list',
          locationId: fixture.list.id,
          name: 'Formulário recebido',
          trigger: { type: 'formSubmitted' },
          actions: [{ type: 'addComment', params: { bodyText: 'Chamado recebido pelo site.' } }],
        })
        .expect(201);
      const form = await createForm(fixture);

      const submitted = await submit(form.token, {
        values: {
          nome: 'Erro no fechamento de caixa',
          detalhe: 'O caixa não fecha no fim do dia.',
          prioridade: 'urgent',
          prazo: '2026-03-10T12:00:00.000Z',
          ambiente: 'producao',
          extra: 'Loja 3',
        },
      }).expect(201);

      expect(submitted.body.received).toBe(true);
      expect(submitted.body.customId).toMatch(/^AZD-\d+$/);

      const task = (
        await withAuth(
          http().get(
            `/api/v1/workspaces/${fixture.workspace.id}/tasks/${submitted.body.taskId as string}`,
          ),
          fixture.owner,
        ).expect(200)
      ).body as TaskBody;

      expect(task.name).toBe('Erro no fechamento de caixa');
      expect(task.priority).toBe('urgent');
      expect(task.dueAt).toBe('2026-03-10T12:00:00.000Z');
      expect(task.assigneeIds).toEqual([fixture.member.userId]);
      expect(task.descriptionText).toContain('O caixa não fecha no fim do dia.');
      expect(task.descriptionText).toContain('Observação: Loja 3');
      expect(task.customFields).toEqual([
        expect.objectContaining({ fieldId: fixture.customFieldId, value: 'producao' }),
      ]);

      const notification = await waitFor(async () => {
        const inbox = await withAuth(
          http().get(`/api/v1/workspaces/${fixture.workspace.id}/inbox`),
          fixture.member.session,
        ).expect(200);
        const found = (inbox.body.items as { type: string; entityId: string }[]).find(
          (one) => one.type === 'formSubmitted',
        );

        return found ?? null;
      });

      expect(notification.entityId).toBe(submitted.body.taskId);

      const run = await waitFor(async () => {
        const runs = await withAuth(
          http().get(
            `/api/v1/workspaces/${fixture.workspace.id}/automations/${automation.body.automation.id as string}/runs`,
          ),
          fixture.owner,
        ).expect(200);

        return (runs.body.items as { status: string }[])[0] ?? null;
      });

      expect(run.status).toBe('success');
    });

    it('recusa o honeypot preenchido, o campo obrigatório vazio e o excesso de envios', async () => {
      const fixture = await setup();
      const form = await createForm(fixture);

      const honeypot = await submit(form.token, {
        values: { nome: 'Spam' },
        website: 'http://spam.example',
      }).expect(400);

      expect(honeypot.body.code).toBe('FORM_SUBMISSION_REJECTED');

      const missing = await submit(form.token, { values: { detalhe: 'sem assunto' } }).expect(400);

      expect(missing.body.code).toBe('INVALID_FORM_SUBMISSION');

      const ip = nextIp();

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await submit(form.token, { values: { nome: `Chamado ${attempt}` } }, ip).expect(201);
      }

      await submit(form.token, { values: { nome: 'Chamado 6' } }, ip).expect(429);
    });

    it('o formulário inativo e o de outra List não respondem', async () => {
      const fixture = await setup();
      const form = await createForm(fixture);

      await withAuth(
        http().patch(`/api/v1/workspaces/${fixture.workspace.id}/forms/${form.form.id}`),
        fixture.owner,
      )
        .send({ active: false })
        .expect(200);

      await http()
        .get(`/api/v1/public/forms/${form.token}`)
        .set('X-Forwarded-For', nextIp())
        .expect(404);

      const denied = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/forms/${form.form.id}`),
        fixture.guest,
      ).expect(404);

      expect(denied.body.code).toBe('FORM_NOT_FOUND');

      const forbidden = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/forms`),
        fixture.guest,
      )
        .send(formPayload(fixture))
        .expect(403);

      expect(forbidden.body.code).toBe('FORBIDDEN_ROLE');
    });

    it('recusa a condição que aponta para um campo inexistente', async () => {
      const fixture = await setup();
      const invalid = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/forms`),
        fixture.owner,
      )
        .send({
          ...formPayload(fixture),
          conditions: [{ fieldId: 'inexistente', op: 'eq', value: 'x', showFieldIds: [] }],
        })
        .expect(400);

      expect(invalid.body.code).toBe('INVALID_FORM');
    });
  });
});
