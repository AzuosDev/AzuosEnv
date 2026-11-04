import request from 'supertest';
import { Session, createSession } from './utils/auth-client';
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
  statusId: string;
  statusGroup: string;
  priority: string | null;
  assigneeIds: string[];
}

interface TaskDetailBody extends TaskBody {
  checklists: { id: string; name: string; items: { id: string; text: string }[] }[];
}

interface AutomationBody {
  id: string;
  name: string;
  active: boolean;
  trigger: { type: string; params: Record<string, unknown> };
  actions: { type: string; params: Record<string, unknown> }[];
  secretHash?: string;
}

interface AutomationResultBody {
  automation: AutomationBody;
  webhookSecret?: string;
  webhookUrl?: string;
}

interface RunBody {
  id: string;
  status: 'success' | 'failed' | 'skipped';
  actionsExecuted: number;
  error: string | null;
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
  statuses: StatusBody[];
}

describe('Automações e templates', () => {
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

  /** Automations run detached from the request, so the assertions wait for them. */
  async function waitFor<T>(probe: () => Promise<T | null>, timeoutMs = 15000): Promise<T> {
    const deadline = Date.now() + timeoutMs;

    for (;;) {
      const found = await probe();

      if (found !== null) {
        return found;
      }

      if (Date.now() >= deadline) {
        throw new Error('A automação não terminou no tempo esperado.');
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  async function addMember(workspace: IdBody, owner: Session): Promise<MemberFixture> {
    const session = await createSession(ctx);
    const invite = await withAuth(http().post(`/api/v1/workspaces/${workspace.id}/invites`), owner)
      .send({ email: session.credentials.email, role: 'member' })
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
        .send({ spaceId: space.id, name: 'uSolutionsPDV — Sprint 3' })
        .expect(201)
    ).body as IdBody;
    const statuses = (
      await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/lists/${list.id}/statuses`),
        owner,
      ).expect(200)
    ).body.statuses as StatusBody[];

    return {
      owner,
      ownerId: me.body.id as string,
      member: await addMember(workspace, owner),
      workspace,
      space,
      list,
      statuses,
    };
  }

  function createAutomation(fixture: Fixture, body: Record<string, unknown>): request.Test {
    return withAuth(
      http().post(`/api/v1/workspaces/${fixture.workspace.id}/automations`),
      fixture.owner,
    ).send({ locationType: 'list', locationId: fixture.list.id, ...body });
  }

  async function createTask(
    fixture: Fixture,
    body: Record<string, unknown> = {},
  ): Promise<TaskBody> {
    const response = await withAuth(
      http().post(`/api/v1/workspaces/${fixture.workspace.id}/lists/${fixture.list.id}/tasks`),
      fixture.owner,
    )
      .send({ name: 'Ajustar PDV', ...body })
      .expect(201);

    return response.body as TaskBody;
  }

  async function getTask(fixture: Fixture, taskId: string): Promise<TaskDetailBody> {
    const response = await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${taskId}`),
      fixture.owner,
    ).expect(200);

    return response.body as TaskDetailBody;
  }

  function patchTask(
    fixture: Fixture,
    taskId: string,
    body: Record<string, unknown>,
  ): request.Test {
    return withAuth(
      http().patch(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${taskId}`),
      fixture.owner,
    ).send(body);
  }

  async function runsOf(fixture: Fixture, automationId: string): Promise<RunBody[]> {
    const response = await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/automations/${automationId}/runs`),
      fixture.owner,
    ).expect(200);

    return response.body.items as RunBody[];
  }

  describe('CRUD e receitas', () => {
    it('lista as receitas prontas com as sete automações da etapa', async () => {
      const fixture = await setup();
      const response = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/automations/recipes`),
        fixture.owner,
      ).expect(200);
      const keys = (response.body.items as { key: string }[]).map((recipe) => recipe.key);

      expect(keys).toEqual([
        'assignOnCreate',
        'reviewerOnStatus',
        'notifyBeforeDue',
        'urgentWhenOverdue',
        'parentDoneOnSubtasks',
        'formToTask',
        'scheduledDigest',
      ]);
    });

    it('recusa uma automação sem ação e um cron inválido', async () => {
      const fixture = await setup();

      await createAutomation(fixture, {
        name: 'Sem ação',
        trigger: { type: 'taskCreated' },
        actions: [],
      }).expect(400);

      const invalid = await createAutomation(fixture, {
        name: 'Agendada',
        trigger: { type: 'schedule', params: { cron: 'todo dia' } },
        actions: [{ type: 'notify', params: { message: 'Oi' } }],
      }).expect(400);

      expect(invalid.body.code).toBe('INVALID_AUTOMATION');
    });

    it('esconde o secret do hook e só devolve o valor na criação', async () => {
      const fixture = await setup();
      const created = (
        await createAutomation(fixture, {
          name: 'Formulário',
          trigger: { type: 'webhookReceived' },
          actions: [{ type: 'createTask', params: { listId: fixture.list.id, name: 'Lead' } }],
        }).expect(201)
      ).body as AutomationResultBody;

      expect(created.webhookSecret).toEqual(expect.any(String));
      expect(created.webhookUrl).toContain(`/hooks/${created.automation.id}/`);
      expect(created.automation.secretHash).toBeUndefined();

      const reloaded = await withAuth(
        http().get(
          `/api/v1/workspaces/${fixture.workspace.id}/automations/${created.automation.id}`,
        ),
        fixture.owner,
      ).expect(200);

      expect(reloaded.body.secretHash).toBeUndefined();
    });

    it('esconde do guest a automação de uma List que ele não vê', async () => {
      const fixture = await setup();
      const created = (
        await createAutomation(fixture, {
          name: 'Atribuir ao criar',
          trigger: { type: 'taskCreated' },
          actions: [{ type: 'assign', params: { userIds: [fixture.ownerId] } }],
        }).expect(201)
      ).body as AutomationResultBody;
      const guest = await createSession(ctx);
      const invite = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/invites`),
        fixture.owner,
      )
        .send({ email: guest.credentials.email, role: 'guest' })
        .expect(201);

      await http()
        .post('/api/v1/invites/accept')
        .set('X-Forwarded-For', guest.credentials.ip)
        .send({ token: invite.body.token })
        .expect(200);

      const denied = await withAuth(
        http().get(
          `/api/v1/workspaces/${fixture.workspace.id}/automations/${created.automation.id}`,
        ),
        guest,
      ).expect(404);

      expect(denied.body.code).toBe('AUTOMATION_NOT_FOUND');
    });
  });

  describe('Motor', () => {
    it('statusChanged atribui o revisor e grava a execução', async () => {
      const fixture = await setup();
      const review = fixture.statuses[1];
      const created = (
        await createAutomation(fixture, {
          name: 'Ao revisar, atribuir',
          trigger: { type: 'statusChanged', params: { toStatusId: review.id } },
          actions: [{ type: 'assign', params: { userIds: [fixture.member.userId] } }],
        }).expect(201)
      ).body as AutomationResultBody;

      const task = await createTask(fixture);

      await patchTask(fixture, task.id, { statusId: review.id }).expect(200);

      const assigned = await waitFor(async () => {
        const current = await getTask(fixture, task.id);

        return current.assigneeIds.includes(fixture.member.userId) ? current : null;
      });

      expect(assigned.statusId).toBe(review.id);

      const runs = await waitFor(async () => {
        const items = await runsOf(fixture, created.automation.id);

        return items.length > 0 ? items : null;
      });

      expect(runs[0]).toMatchObject({ status: 'success', actionsExecuted: 1, error: null });
    });

    it('pula a automação quando a condição não passa', async () => {
      const fixture = await setup();
      const created = (
        await createAutomation(fixture, {
          name: 'Só urgentes',
          trigger: { type: 'taskCreated' },
          conditions: [{ field: 'priority', op: 'eq', value: 'urgent' }],
          actions: [{ type: 'assign', params: { userIds: [fixture.member.userId] } }],
        }).expect(201)
      ).body as AutomationResultBody;

      const task = await createTask(fixture, { priority: 'low' });
      const runs = await waitFor(async () => {
        const items = await runsOf(fixture, created.automation.id);

        return items.length > 0 ? items : null;
      });

      expect(runs[0].status).toBe('skipped');
      expect((await getTask(fixture, task.id)).assigneeIds).toEqual([]);
    });

    it('allSubtasksDone fecha a tarefa-pai', async () => {
      const fixture = await setup();
      const done = fixture.statuses.find((status) => status.group === 'done');

      expect(done).toBeDefined();

      await createAutomation(fixture, {
        name: 'Fechar a mãe',
        trigger: { type: 'allSubtasksDone' },
        actions: [{ type: 'setStatus', params: { statusGroup: 'done' } }],
      }).expect(201);

      const parent = await createTask(fixture, { name: 'Entrega do sprint' });
      const first = await createTask(fixture, { name: 'Subtarefa 1', parentTaskId: parent.id });
      const second = await createTask(fixture, { name: 'Subtarefa 2', parentTaskId: parent.id });

      await patchTask(fixture, first.id, { statusId: done?.id }).expect(200);

      expect((await getTask(fixture, parent.id)).statusGroup).not.toBe('done');

      await patchTask(fixture, second.id, { statusId: done?.id }).expect(200);

      const closed = await waitFor(async () => {
        const current = await getTask(fixture, parent.id);

        return current.statusGroup === 'done' ? current : null;
      });

      expect(closed.statusId).toBe(done?.id);
    });

    it('corta o laço entre duas automações que se disparam', async () => {
      const fixture = await setup();
      const first = (
        await createAutomation(fixture, {
          name: 'Prioridade mudou, atribuir',
          trigger: { type: 'priorityChanged' },
          actions: [{ type: 'assign', params: { userIds: [fixture.member.userId] } }],
        }).expect(201)
      ).body as AutomationResultBody;
      const second = (
        await createAutomation(fixture, {
          name: 'Responsável mudou, priorizar',
          trigger: { type: 'assigneeChanged' },
          actions: [{ type: 'setPriority', params: { priority: 'high' } }],
        }).expect(201)
      ).body as AutomationResultBody;

      const task = await createTask(fixture);

      await patchTask(fixture, task.id, { priority: 'low' }).expect(200);

      const settled = await waitFor(async () => {
        const current = await getTask(fixture, task.id);

        return current.priority === 'high' && current.assigneeIds.includes(fixture.member.userId)
          ? current
          : null;
      });

      expect(settled.priority).toBe('high');

      // Nothing new may show up: the chain already holds both automations.
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(await runsOf(fixture, first.automation.id)).toHaveLength(1);
      expect(await runsOf(fixture, second.automation.id)).toHaveLength(1);
    });
  });

  describe('Hook público', () => {
    it('cria a tarefa com o secret certo e responde 404 com o errado', async () => {
      const fixture = await setup();
      const created = (
        await createAutomation(fixture, {
          name: 'Formulário vira tarefa',
          trigger: { type: 'formSubmitted' },
          actions: [
            {
              type: 'createTask',
              params: { listId: fixture.list.id, name: '{{payload.name}}' },
            },
          ],
        }).expect(201)
      ).body as AutomationResultBody;
      const hook = `/api/v1/hooks/${created.automation.id}`;

      const denied = await http()
        .post(`${hook}/secret-errado`)
        .set('X-Forwarded-For', fixture.owner.credentials.ip)
        .send({ name: 'Lead falso' })
        .expect(404);

      expect(denied.body.code).toBe('AUTOMATION_NOT_FOUND');

      await http()
        .post(`${hook}/${created.webhookSecret}`)
        .set('X-Forwarded-For', fixture.owner.credentials.ip)
        .send({ name: 'Orçamento Cênio' })
        .expect(200);

      const names = await waitFor(async () => {
        const response = await withAuth(
          http().get(
            `/api/v1/workspaces/${fixture.workspace.id}/tasks/query?location=list&locationId=${fixture.list.id}`,
          ),
          fixture.owner,
        ).expect(200);
        const items = (response.body.items as TaskBody[]).map((task) => task.name);

        return items.includes('Orçamento Cênio') ? items : null;
      });

      expect(names).not.toContain('Lead falso');
    });
  });

  describe('Templates', () => {
    it('aplicar um template de List recria as tarefas e os checklists', async () => {
      const fixture = await setup();
      const task = await createTask(fixture, {
        name: 'Subir ambiente',
        priority: 'high',
        dueAt: '2026-04-10T12:00:00.000Z',
      });
      const checklist = (
        await withAuth(
          http().post(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${task.id}/checklists`),
          fixture.owner,
        )
          .send({ name: 'Passos' })
          .expect(201)
      ).body as IdBody;

      for (const text of ['Criar banco', 'Publicar API']) {
        await withAuth(
          http().post(
            `/api/v1/workspaces/${fixture.workspace.id}/checklists/${checklist.id}/items`,
          ),
          fixture.owner,
        )
          .send({ text })
          .expect(201);
      }

      const template = (
        await withAuth(
          http().post(`/api/v1/workspaces/${fixture.workspace.id}/templates`),
          fixture.owner,
        )
          .send({ type: 'list', name: 'Sprint padrão', sourceId: fixture.list.id })
          .expect(201)
      ).body as IdBody;

      const applied = (
        await withAuth(
          http().post(`/api/v1/workspaces/${fixture.workspace.id}/templates/${template.id}/apply`),
          fixture.owner,
        )
          .send({ targetType: 'space', targetId: fixture.space.id, name: 'Sprint 4' })
          .expect(201)
      ).body as IdBody & { name: string };

      expect(applied.name).toBe('Sprint 4');
      expect(applied.id).not.toBe(fixture.list.id);

      const copied = (
        await withAuth(
          http().get(
            `/api/v1/workspaces/${fixture.workspace.id}/tasks/query?location=list&locationId=${applied.id}`,
          ),
          fixture.owner,
        ).expect(200)
      ).body.items as TaskBody[];

      expect(copied).toHaveLength(1);
      expect(copied[0]).toMatchObject({ name: 'Subir ambiente', priority: 'high' });
      expect(copied[0].id).not.toBe(task.id);

      const detail = await getTask(fixture, copied[0].id);

      expect(detail.checklists).toHaveLength(1);
      expect(detail.checklists[0].name).toBe('Passos');
      expect(detail.checklists[0].items.map((item) => item.text)).toEqual([
        'Criar banco',
        'Publicar API',
      ]);
      expect(detail.checklists[0].id).not.toBe(checklist.id);
    });

    it('recusa aplicar sem o local de destino', async () => {
      const fixture = await setup();
      const template = (
        await withAuth(
          http().post(`/api/v1/workspaces/${fixture.workspace.id}/templates`),
          fixture.owner,
        )
          .send({ type: 'list', name: 'Sprint padrão', sourceId: fixture.list.id })
          .expect(201)
      ).body as IdBody;

      const denied = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/templates/${template.id}/apply`),
        fixture.owner,
      )
        .send({})
        .expect(400);

      expect(denied.body.code).toBe('INVALID_TEMPLATE_TARGET');
    });
  });
});
