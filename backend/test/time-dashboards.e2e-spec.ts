import request from 'supertest';
import { Types } from 'mongoose';
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
  trackedMinutes: number;
}

interface TimeEntryBody {
  id: string;
  taskId: string;
  userId: string;
  start: string;
  end: string | null;
  durationMinutes: number;
  billable: boolean;
  source: 'timer' | 'manual';
  approvalStatus: 'draft' | 'submitted' | 'approved' | 'rejected';
}

interface TimesheetBody {
  weekStart: string;
  days: string[];
  rows: {
    taskId: string;
    customId: string;
    client: string;
    minutes: Record<string, number>;
    total: number;
  }[];
  totals: { byDay: Record<string, number>; total: number; billableMinutes: number };
  approvalStatus: string;
}

interface WorkloadBody {
  days: string[];
  metric: string;
  members: { userId: string; capacityPerDay: number; total: number; byDay: Record<string, number> }[];
}

interface DashboardBody {
  id: string;
  name: string;
  private: boolean;
  cards: { id: string; type: string; config: Record<string, unknown> }[];
}

interface MemberFixture {
  session: Session;
  userId: string;
}

interface Fixture {
  owner: Session;
  ownerId: string;
  admin: MemberFixture;
  member: MemberFixture;
  guest: MemberFixture;
  workspace: IdBody;
  space: IdBody;
  folder: IdBody;
  list: IdBody;
  statuses: StatusBody[];
}

/** Week of Monday 2026-01-05; the workspace runs in UTC so the days are literal. */
const WEEK_START = '2026-01-05';

describe('Tempo, timesheets, workload e dashboards', () => {
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
    const folder = (
      await withAuth(http().post(`/api/v1/workspaces/${workspace.id}/folders`), owner)
        .send({ spaceId: space.id, name: 'Cênio Construções' })
        .expect(201)
    ).body as IdBody;
    const list = (
      await withAuth(http().post(`/api/v1/workspaces/${workspace.id}/lists`), owner)
        .send({ spaceId: space.id, folderId: folder.id, name: 'uSolutionsPDV — Sprint 3' })
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
      admin: await addMember(workspace, owner, 'admin'),
      member: await addMember(workspace, owner, 'member'),
      guest: await addMember(workspace, owner, 'guest'),
      workspace,
      space,
      folder,
      list,
      statuses,
    };
  }

  async function createTask(
    fixture: Fixture,
    session: Session,
    body: Record<string, unknown> = {},
  ): Promise<TaskBody> {
    const response = await withAuth(
      http().post(`/api/v1/workspaces/${fixture.workspace.id}/lists/${fixture.list.id}/tasks`),
      session,
    )
      .send({ name: 'Ajustar PDV', ...body })
      .expect(201);

    return response.body as TaskBody;
  }

  function logTime(
    fixture: Fixture,
    session: Session,
    body: Record<string, unknown>,
  ): request.Test {
    return withAuth(
      http().post(`/api/v1/workspaces/${fixture.workspace.id}/time/entries`),
      session,
    ).send(body);
  }

  function getTask(fixture: Fixture, session: Session, taskId: string): request.Test {
    return withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${taskId}`),
      session,
    );
  }

  async function createDashboard(
    fixture: Fixture,
    session: Session,
    body: Record<string, unknown>,
  ): Promise<DashboardBody> {
    const response = await withAuth(
      http().post(`/api/v1/workspaces/${fixture.workspace.id}/dashboards`),
      session,
    )
      .send(body)
      .expect(201);

    return response.body as DashboardBody;
  }

  function cardData(
    fixture: Fixture,
    session: Session,
    dashboard: DashboardBody,
    cardId: string,
    body: Record<string, unknown> = {},
  ): request.Test {
    return withAuth(
      http().post(
        `/api/v1/workspaces/${fixture.workspace.id}/dashboards/${dashboard.id}/cards/${cardId}/data`,
      ),
      session,
    ).send(body);
  }

  /** closedAt is stamped by the status change; the chart needs fixed days. */
  async function closeTaskAt(taskId: string, closedAt: string): Promise<void> {
    await ctx.connection
      .collection('tasks')
      .updateOne(
        { _id: new Types.ObjectId(taskId) },
        { $set: { closedAt: new Date(closedAt), statusGroup: 'done' } },
      );
  }

  describe('cronômetro', () => {
    it('para o cronômetro anterior ao iniciar outro', async () => {
      const fixture = await setup();
      const first = await createTask(fixture, fixture.owner);
      const second = await createTask(fixture, fixture.owner, { name: 'Revisar PR' });

      const started = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/time/timer/start`),
        fixture.owner,
      )
        .send({ taskId: first.id })
        .expect(200);

      expect((started.body.entry as TimeEntryBody).end).toBeNull();
      expect(started.body.stopped).toBeNull();

      const again = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/time/timer/start`),
        fixture.owner,
      )
        .send({ taskId: second.id })
        .expect(200);

      const stopped = again.body.stopped as TimeEntryBody;

      expect(stopped.id).toBe((started.body.entry as TimeEntryBody).id);
      expect(stopped.end).not.toBeNull();

      const current = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/time/timer/current`),
        fixture.owner,
      ).expect(200);

      expect((current.body.entry as TimeEntryBody).taskId).toBe(second.id);
    });

    it('para e recusa parar duas vezes', async () => {
      const fixture = await setup();
      const task = await createTask(fixture, fixture.owner);

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/time/timer/start`),
        fixture.owner,
      )
        .send({ taskId: task.id })
        .expect(200);

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/time/timer/stop`),
        fixture.owner,
      ).expect(200);

      const empty = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/time/timer/stop`),
        fixture.owner,
      ).expect(404);

      expect(empty.body.code).toBe('TIMER_NOT_RUNNING');
    });

    it('nega a tarefa invisível e recusa o corpo inválido', async () => {
      const fixture = await setup();
      const task = await createTask(fixture, fixture.owner);

      const denied = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/time/timer/start`),
        fixture.guest.session,
      )
        .send({ taskId: task.id })
        .expect(404);

      expect(denied.body.code).toBe('TASK_NOT_FOUND');

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/time/timer/start`),
        fixture.owner,
      )
        .send({})
        .expect(400);
    });
  });

  describe('lançamentos manuais', () => {
    it('cria pelo fim ou pela duração e soma em trackedMinutes', async () => {
      const fixture = await setup();
      const task = await createTask(fixture, fixture.owner);

      const entry = (
        await logTime(fixture, fixture.owner, {
          taskId: task.id,
          start: `${WEEK_START}T09:00:00.000Z`,
          end: `${WEEK_START}T11:00:00.000Z`,
          billable: true,
          note: 'Pareamento',
        }).expect(201)
      ).body as TimeEntryBody;

      expect(entry.durationMinutes).toBe(120);
      expect(entry.source).toBe('manual');

      const byDuration = (
        await logTime(fixture, fixture.owner, {
          taskId: task.id,
          start: `${WEEK_START}T14:00:00.000Z`,
          durationMinutes: 30,
        }).expect(201)
      ).body as TimeEntryBody;

      expect(byDuration.end).toBe(`${WEEK_START}T14:30:00.000Z`);

      const reloaded = await getTask(fixture, fixture.owner, task.id).expect(200);

      expect((reloaded.body as TaskBody).trackedMinutes).toBe(150);
    });

    it('recusa intervalo inválido e lançamento sem fim nem duração', async () => {
      const fixture = await setup();
      const task = await createTask(fixture, fixture.owner);

      const inverted = await logTime(fixture, fixture.owner, {
        taskId: task.id,
        start: `${WEEK_START}T11:00:00.000Z`,
        end: `${WEEK_START}T09:00:00.000Z`,
      }).expect(400);

      expect(inverted.body.code).toBe('INVALID_TIME_ENTRY');

      await logTime(fixture, fixture.owner, {
        taskId: task.id,
        start: `${WEEK_START}T11:00:00.000Z`,
      }).expect(400);
    });

    it('edita e remove só o próprio lançamento', async () => {
      const fixture = await setup();
      const task = await createTask(fixture, fixture.owner);
      const entry = (
        await logTime(fixture, fixture.owner, {
          taskId: task.id,
          start: `${WEEK_START}T09:00:00.000Z`,
          durationMinutes: 60,
        }).expect(201)
      ).body as TimeEntryBody;

      const updated = await withAuth(
        http().patch(`/api/v1/workspaces/${fixture.workspace.id}/time/entries/${entry.id}`),
        fixture.owner,
      )
        .send({ durationMinutes: 90, billable: true })
        .expect(200);

      expect((updated.body as TimeEntryBody).durationMinutes).toBe(90);

      const denied = await withAuth(
        http().delete(`/api/v1/workspaces/${fixture.workspace.id}/time/entries/${entry.id}`),
        fixture.member.session,
      ).expect(404);

      expect(denied.body.code).toBe('TIME_ENTRY_NOT_FOUND');

      await withAuth(
        http().delete(`/api/v1/workspaces/${fixture.workspace.id}/time/entries/${entry.id}`),
        fixture.owner,
      ).expect(200);

      const reloaded = await getTask(fixture, fixture.owner, task.id).expect(200);

      expect((reloaded.body as TaskBody).trackedMinutes).toBe(0);
    });

    it('só admin lista o tempo de outra pessoa', async () => {
      const fixture = await setup();

      const denied = await withAuth(
        http().get(
          `/api/v1/workspaces/${fixture.workspace.id}/time/entries?userId=${fixture.member.userId}`,
        ),
        fixture.member.session,
      ).expect(200);

      expect(denied.body.items).toEqual([]);

      const forbidden = await withAuth(
        http().get(
          `/api/v1/workspaces/${fixture.workspace.id}/time/entries?userId=${fixture.ownerId}`,
        ),
        fixture.member.session,
      ).expect(403);

      expect(forbidden.body.code).toBe('FORBIDDEN_ROLE');

      await withAuth(
        http().get(
          `/api/v1/workspaces/${fixture.workspace.id}/time/entries?userId=${fixture.ownerId}`,
        ),
        fixture.admin.session,
      ).expect(200);
    });
  });

  describe('timesheets', () => {
    async function weekOfMember(fixture: Fixture): Promise<TaskBody> {
      const task = await createTask(fixture, fixture.owner);

      await logTime(fixture, fixture.member.session, {
        taskId: task.id,
        start: `${WEEK_START}T09:00:00.000Z`,
        durationMinutes: 120,
        billable: true,
      }).expect(201);

      await logTime(fixture, fixture.member.session, {
        taskId: task.id,
        start: '2026-01-07T09:00:00.000Z',
        durationMinutes: 60,
      }).expect(201);

      return task;
    }

    it('monta a grade da semana com cliente e totais', async () => {
      const fixture = await setup();
      const task = await weekOfMember(fixture);

      const response = await withAuth(
        http().get(
          `/api/v1/workspaces/${fixture.workspace.id}/timesheets?weekStart=2026-01-08`,
        ),
        fixture.member.session,
      ).expect(200);

      const sheet = response.body as TimesheetBody;

      expect(sheet.weekStart).toBe(WEEK_START);
      expect(sheet.days).toHaveLength(7);
      expect(sheet.totals.total).toBe(180);
      expect(sheet.totals.billableMinutes).toBe(120);
      expect(sheet.totals.byDay[WEEK_START]).toBe(120);
      expect(sheet.totals.byDay['2026-01-07']).toBe(60);
      expect(sheet.rows).toHaveLength(1);
      expect(sheet.rows[0].taskId).toBe(task.id);
      expect(sheet.rows[0].client).toBe('Cênio Construções');
      expect(sheet.approvalStatus).toBe('draft');
    });

    it('envia a semana e trava a edição dos lançamentos', async () => {
      const fixture = await setup();
      const task = await weekOfMember(fixture);

      const submitted = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/timesheets/submit`),
        fixture.member.session,
      )
        .send({ weekStart: WEEK_START })
        .expect(200);

      expect(submitted.body).toMatchObject({ weekStart: WEEK_START, updated: 2 });

      const entries = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/time/entries?taskId=${task.id}`),
        fixture.member.session,
      ).expect(200);

      const entry = (entries.body.items as TimeEntryBody[])[0];

      expect(entry.approvalStatus).toBe('submitted');

      const locked = await withAuth(
        http().patch(`/api/v1/workspaces/${fixture.workspace.id}/time/entries/${entry.id}`),
        fixture.member.session,
      )
        .send({ durationMinutes: 10 })
        .expect(400);

      expect(locked.body.code).toBe('TIME_ENTRY_LOCKED');
    });

    it('só admin vê e aprova as semanas enviadas', async () => {
      const fixture = await setup();

      await weekOfMember(fixture);
      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/timesheets/submit`),
        fixture.member.session,
      )
        .send({ weekStart: WEEK_START })
        .expect(200);

      const denied = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/timesheets/approvals`),
        fixture.member.session,
      ).expect(403);

      expect(denied.body.code).toBe('FORBIDDEN_ROLE');

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/timesheets/approve`),
        fixture.member.session,
      )
        .send({ userId: fixture.member.userId, weekStart: WEEK_START })
        .expect(403);

      const approvals = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/timesheets/approvals`),
        fixture.admin.session,
      ).expect(200);

      expect(approvals.body.items).toHaveLength(1);
      expect(approvals.body.items[0]).toMatchObject({
        userId: fixture.member.userId,
        weekStart: WEEK_START,
        totalMinutes: 180,
      });

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/timesheets/approve`),
        fixture.admin.session,
      )
        .send({ userId: fixture.member.userId, weekStart: WEEK_START })
        .expect(200);

      const sheet = await withAuth(
        http().get(
          `/api/v1/workspaces/${fixture.workspace.id}/timesheets?weekStart=${WEEK_START}&userId=${fixture.member.userId}`,
        ),
        fixture.admin.session,
      ).expect(200);

      expect((sheet.body as TimesheetBody).approvalStatus).toBe('approved');

      const missing = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/timesheets/reject`),
        fixture.admin.session,
      )
        .send({ userId: fixture.member.userId, weekStart: WEEK_START })
        .expect(404);

      expect(missing.body.code).toBe('TIMESHEET_NOT_FOUND');
    });

    it('exporta a semana em CSV e recusa data inválida', async () => {
      const fixture = await setup();

      await weekOfMember(fixture);

      const csv = await withAuth(
        http().get(
          `/api/v1/workspaces/${fixture.workspace.id}/timesheets/export?weekStart=${WEEK_START}`,
        ),
        fixture.member.session,
      ).expect(200);

      expect(csv.headers['content-type']).toContain('text/csv');
      expect(csv.text).toContain('Cênio Construções');
      expect(csv.text).toContain('"Total"');

      await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/timesheets?weekStart=05/01/2026`),
        fixture.member.session,
      ).expect(400);
    });
  });

  describe('workload', () => {
    it('conta tarefas por pessoa e dia com a capacidade do membro', async () => {
      const fixture = await setup();

      await createTask(fixture, fixture.owner, {
        name: 'Tarefa A',
        dueAt: `${WEEK_START}T12:00:00.000Z`,
        assigneeIds: [fixture.ownerId],
        points: 3,
      });
      await createTask(fixture, fixture.owner, {
        name: 'Tarefa B',
        dueAt: '2026-01-06T12:00:00.000Z',
        assigneeIds: [fixture.ownerId],
        points: 5,
      });

      const response = await withAuth(
        http().get(
          `/api/v1/workspaces/${fixture.workspace.id}/workload?from=${WEEK_START}&to=2026-01-09`,
        ),
        fixture.owner,
      ).expect(200);

      const workload = response.body as WorkloadBody;
      const owner = workload.members.find((member) => member.userId === fixture.ownerId);

      expect(workload.days).toHaveLength(5);
      expect(owner?.capacityPerDay).toBe(8);
      expect(owner?.total).toBe(2);
      expect(owner?.byDay[WEEK_START]).toBe(1);
      expect(owner?.byDay['2026-01-06']).toBe(1);
    });

    it('soma horas lançadas e recusa recorte sem data', async () => {
      const fixture = await setup();
      const task = await createTask(fixture, fixture.owner);

      await logTime(fixture, fixture.owner, {
        taskId: task.id,
        start: `${WEEK_START}T09:00:00.000Z`,
        durationMinutes: 90,
      }).expect(201);

      const response = await withAuth(
        http().get(
          `/api/v1/workspaces/${fixture.workspace.id}/workload?from=${WEEK_START}&to=2026-01-09&metric=hours`,
        ),
        fixture.owner,
      ).expect(200);

      const owner = (response.body as WorkloadBody).members.find(
        (member) => member.userId === fixture.ownerId,
      );

      expect(owner?.byDay[WEEK_START]).toBe(1.5);

      await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/workload?to=2026-01-09`),
        fixture.owner,
      ).expect(400);
    });
  });

  describe('dashboards', () => {
    it('esconde o dashboard privado das outras pessoas', async () => {
      const fixture = await setup();
      const dashboard = await createDashboard(fixture, fixture.owner, {
        name: 'Diretoria',
        private: true,
        cards: [{ type: 'tasksByStatus', config: { location: 'list', locationId: fixture.list.id } }],
      });

      const mine = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/dashboards`),
        fixture.owner,
      ).expect(200);

      expect(mine.body.items).toHaveLength(1);

      const others = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/dashboards`),
        fixture.member.session,
      ).expect(200);

      expect(others.body.items).toEqual([]);

      const denied = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/dashboards/${dashboard.id}`),
        fixture.member.session,
      ).expect(404);

      expect(denied.body.code).toBe('DASHBOARD_NOT_FOUND');
    });

    it('só o dono ou um admin altera o dashboard', async () => {
      const fixture = await setup();
      const dashboard = await createDashboard(fixture, fixture.owner, { name: 'Entregas' });

      const denied = await withAuth(
        http().patch(`/api/v1/workspaces/${fixture.workspace.id}/dashboards/${dashboard.id}`),
        fixture.member.session,
      )
        .send({ name: 'Outro nome' })
        .expect(403);

      expect(denied.body.code).toBe('FORBIDDEN_DASHBOARD');

      await withAuth(
        http().patch(`/api/v1/workspaces/${fixture.workspace.id}/dashboards/${dashboard.id}`),
        fixture.admin.session,
      )
        .send({ name: 'Entregas da semana' })
        .expect(200);

      await withAuth(
        http().delete(`/api/v1/workspaces/${fixture.workspace.id}/dashboards/${dashboard.id}`),
        fixture.owner,
      ).expect(200);
    });

    it('recusa card inválido e card inexistente', async () => {
      const fixture = await setup();

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/dashboards`),
        fixture.owner,
      )
        .send({ name: 'Inválido', cards: [{ type: 'naoExiste' }] })
        .expect(400);

      const dashboard = await createDashboard(fixture, fixture.owner, { name: 'Entregas' });
      const missing = await cardData(fixture, fixture.owner, dashboard, 'sem-card').expect(404);

      expect(missing.body.code).toBe('CARD_NOT_FOUND');
    });

    it('agrega tarefas por status e exporta o card em CSV', async () => {
      const fixture = await setup();

      await createTask(fixture, fixture.owner, { name: 'Tarefa A' });
      await createTask(fixture, fixture.owner, { name: 'Tarefa B' });

      const dashboard = await createDashboard(fixture, fixture.owner, {
        name: 'Entregas',
        cards: [{ type: 'tasksByStatus', config: { location: 'list', locationId: fixture.list.id } }],
      });
      const cardId = dashboard.cards[0].id;
      const response = await cardData(fixture, fixture.owner, dashboard, cardId).expect(200);

      expect(response.body.type).toBe('tasksByStatus');
      expect(response.body.data.total).toBe(2);
      expect(response.body.data.items[0]).toMatchObject({ count: 2 });

      const csv = await withAuth(
        http().get(
          `/api/v1/workspaces/${fixture.workspace.id}/dashboards/${dashboard.id}/cards/${cardId}/export`,
        ),
        fixture.owner,
      ).expect(200);

      expect(csv.headers['content-type']).toContain('text/csv');
      expect(csv.text).toContain('"Status","Tarefas"');
    });

    it('desenha o burndown com tarefas fechadas em dias diferentes', async () => {
      const fixture = await setup();
      const first = await createTask(fixture, fixture.owner, { name: 'Tarefa A' });
      const second = await createTask(fixture, fixture.owner, { name: 'Tarefa B' });

      await createTask(fixture, fixture.owner, { name: 'Tarefa C' });
      await closeTaskAt(first.id, '2026-01-06T10:00:00.000Z');
      await closeTaskAt(second.id, '2026-01-08T10:00:00.000Z');

      const dashboard = await createDashboard(fixture, fixture.owner, {
        name: 'Sprint 3',
        cards: [
          {
            type: 'burndown',
            config: {
              location: 'list',
              locationId: fixture.list.id,
              from: WEEK_START,
              to: '2026-01-08',
            },
          },
        ],
      });

      const response = await cardData(
        fixture,
        fixture.owner,
        dashboard,
        dashboard.cards[0].id,
      ).expect(200);

      expect(response.body.data.total).toBe(3);
      expect(response.body.data.days).toHaveLength(4);
      expect(response.body.data.remaining).toEqual([3, 2, 2, 1]);
      expect(response.body.data.ideal).toEqual([3, 2, 1, 0]);
    });

    it('soma o tempo por cliente e por pessoa', async () => {
      const fixture = await setup();
      const task = await createTask(fixture, fixture.owner);

      await logTime(fixture, fixture.owner, {
        taskId: task.id,
        start: `${WEEK_START}T09:00:00.000Z`,
        durationMinutes: 120,
        billable: true,
      }).expect(201);
      await logTime(fixture, fixture.member.session, {
        taskId: task.id,
        start: '2026-01-06T09:00:00.000Z',
        durationMinutes: 60,
      }).expect(201);

      const dashboard = await createDashboard(fixture, fixture.owner, {
        name: 'Faturamento',
        cards: [
          { type: 'timeByClient', config: { location: 'list', locationId: fixture.list.id } },
          { type: 'billable', config: { location: 'list', locationId: fixture.list.id } },
        ],
      });

      const byClient = await cardData(
        fixture,
        fixture.owner,
        dashboard,
        dashboard.cards[0].id,
      ).expect(200);

      expect(byClient.body.data.items[0]).toMatchObject({
        client: 'Cênio Construções',
        minutes: 180,
        hours: 3,
      });

      const billable = await cardData(
        fixture,
        fixture.owner,
        dashboard,
        dashboard.cards[1].id,
      ).expect(200);

      expect(billable.body.data).toMatchObject({
        totalMinutes: 180,
        billableMinutes: 120,
        nonBillableMinutes: 60,
        billablePercent: 67,
      });
    });

    it('calcula a soma de um campo numérico da tarefa', async () => {
      const fixture = await setup();

      await createTask(fixture, fixture.owner, { name: 'Tarefa A', points: 3 });
      await createTask(fixture, fixture.owner, { name: 'Tarefa B', points: 5 });

      const dashboard = await createDashboard(fixture, fixture.owner, {
        name: 'Pontos',
        cards: [
          {
            type: 'calculator',
            config: { location: 'list', locationId: fixture.list.id, taskField: 'points' },
          },
        ],
      });

      const response = await cardData(
        fixture,
        fixture.owner,
        dashboard,
        dashboard.cards[0].id,
      ).expect(200);

      expect(response.body.data).toMatchObject({ op: 'sum', value: 8, count: 2 });

      const average = await cardData(fixture, fixture.owner, dashboard, dashboard.cards[0].id, {
        config: { op: 'avg' },
      }).expect(200);

      expect(average.body.data).toMatchObject({ op: 'avg', value: 4 });
    });
  });
});
