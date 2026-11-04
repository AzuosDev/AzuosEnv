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
  listId: string;
  statusId: string;
  statusGroup: string;
}

interface EventBody {
  id: string;
  title: string;
  start: string;
  end: string;
  taskId: string | null;
  source: string;
}

interface PlannerBody {
  from: string;
  to: string;
  events: EventBody[];
  dueTasks: TaskBody[];
  unscheduledTasks: TaskBody[];
}

interface SprintBody extends IdBody {
  name: string;
  startDate: string | null;
  endDate: string | null;
  sprintFolderId: string | null;
  sprintClosedAt: string | null;
}

interface SprintFolderBody extends IdBody {
  name: string;
  durationDays: number;
  folderId: string;
}

interface SprintFolderView {
  sprintFolder: SprintFolderBody;
  sprints: SprintBody[];
}

interface Fixture {
  owner: Session;
  ownerId: string;
  guest: Session;
  workspace: IdBody;
  space: IdBody;
  list: IdBody;
  statuses: StatusBody[];
}

const FROM = '2026-02-02T00:00:00.000Z';
const TO = '2026-02-09T00:00:00.000Z';

describe('Planner e sprints', () => {
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
  ): Promise<Session> {
    const session = await createSession(ctx);
    const invite = await withAuth(http().post(`/api/v1/workspaces/${workspace.id}/invites`), owner)
      .send({ email: session.credentials.email, role })
      .expect(201);

    await http()
      .post('/api/v1/invites/accept')
      .set('X-Forwarded-For', session.credentials.ip)
      .send({ token: invite.body.token })
      .expect(200);

    return session;
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
      guest: await addMember(workspace, owner, 'guest'),
      workspace,
      space,
      list,
      statuses,
    };
  }

  async function createTask(
    fixture: Fixture,
    body: Record<string, unknown> = {},
    listId = fixture.list.id,
  ): Promise<TaskBody> {
    const response = await withAuth(
      http().post(`/api/v1/workspaces/${fixture.workspace.id}/lists/${listId}/tasks`),
      fixture.owner,
    )
      .send({ name: 'Ajustar PDV', assigneeIds: [fixture.ownerId], ...body })
      .expect(201);

    return response.body as TaskBody;
  }

  async function tasksOf(fixture: Fixture, listId: string): Promise<TaskBody[]> {
    const response = await withAuth(
      http()
        .get(`/api/v1/workspaces/${fixture.workspace.id}/tasks/query`)
        .query({ location: 'list', locationId: listId, includeClosed: true }),
      fixture.owner,
    ).expect(200);

    return response.body.items as TaskBody[];
  }

  function doneStatus(fixture: Fixture): StatusBody {
    const status = fixture.statuses.find((one) => one.group === 'done');

    if (!status) {
      throw new Error('O conjunto de status não tem um status do grupo done.');
    }

    return status;
  }

  async function planner(fixture: Fixture, session = fixture.owner): Promise<PlannerBody> {
    const response = await withAuth(
      http()
        .get(`/api/v1/workspaces/${fixture.workspace.id}/me/planner`)
        .query({ from: FROM, to: TO }),
      session,
    ).expect(200);

    return response.body as PlannerBody;
  }

  describe('Planner e calendário', () => {
    it('lista a tarefa sem bloco e tira ela da lista depois de agendar', async () => {
      const fixture = await setup();
      const task = await createTask(fixture, { dueAt: '2026-02-04T12:00:00.000Z' });

      const before = await planner(fixture);

      expect(before.unscheduledTasks.map((one) => one.id)).toContain(task.id);
      expect(before.dueTasks.map((one) => one.id)).toContain(task.id);
      expect(before.events).toHaveLength(0);

      const block = (
        await withAuth(
          http().post(`/api/v1/workspaces/${fixture.workspace.id}/me/planner/blocks`),
          fixture.owner,
        )
          .send({
            taskId: task.id,
            start: '2026-02-04T13:00:00.000Z',
            end: '2026-02-04T14:00:00.000Z',
          })
          .expect(201)
      ).body as EventBody;

      expect(block.taskId).toBe(task.id);
      expect(block.source).toBe('local');

      const after = await planner(fixture);

      expect(after.unscheduledTasks.map((one) => one.id)).not.toContain(task.id);
      expect(after.events.map((one) => one.id)).toEqual([block.id]);
    });

    it('cria, atualiza e exclui um evento do calendário', async () => {
      const fixture = await setup();
      const created = (
        await withAuth(
          http().post(`/api/v1/workspaces/${fixture.workspace.id}/calendar/events`),
          fixture.owner,
        )
          .send({
            title: 'Daily uSolutionsPDV',
            start: '2026-02-03T12:00:00.000Z',
            end: '2026-02-03T12:15:00.000Z',
            meetUrl: 'https://meet.google.com/abc-defg-hij',
            recurrence: 'FREQ=DAILY',
          })
          .expect(201)
      ).body as EventBody;

      const updated = await withAuth(
        http().patch(`/api/v1/workspaces/${fixture.workspace.id}/calendar/events/${created.id}`),
        fixture.owner,
      )
        .send({ title: 'Daily do PDV', allDay: false })
        .expect(200);

      expect(updated.body.title).toBe('Daily do PDV');

      const list = await withAuth(
        http()
          .get(`/api/v1/workspaces/${fixture.workspace.id}/calendar/events`)
          .query({ from: FROM, to: TO }),
        fixture.owner,
      ).expect(200);

      expect(list.body.items.map((one: EventBody) => one.id)).toEqual([created.id]);

      await withAuth(
        http().delete(`/api/v1/workspaces/${fixture.workspace.id}/calendar/events/${created.id}`),
        fixture.owner,
      ).expect(200);

      await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/calendar/events/${created.id}`),
        fixture.owner,
      ).expect(404);
    });

    it('recusa o evento com fim antes do início e o período grande demais', async () => {
      const fixture = await setup();
      const invalid = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/calendar/events`),
        fixture.owner,
      )
        .send({
          title: 'Reunião',
          start: '2026-02-03T12:00:00.000Z',
          end: '2026-02-03T11:00:00.000Z',
        })
        .expect(400);

      expect(invalid.body.code).toBe('INVALID_EVENT_RANGE');

      const range = await withAuth(
        http()
          .get(`/api/v1/workspaces/${fixture.workspace.id}/me/planner`)
          .query({ from: FROM, to: '2027-02-09T00:00:00.000Z' }),
        fixture.owner,
      ).expect(400);

      expect(range.body.code).toBe('INVALID_DATE_RANGE');
    });

    it('não entrega o evento de outro usuário', async () => {
      const fixture = await setup();
      const created = (
        await withAuth(
          http().post(`/api/v1/workspaces/${fixture.workspace.id}/calendar/events`),
          fixture.owner,
        )
          .send({
            title: 'Reunião interna',
            start: '2026-02-03T12:00:00.000Z',
            end: '2026-02-03T13:00:00.000Z',
          })
          .expect(201)
      ).body as EventBody;

      const denied = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/calendar/events/${created.id}`),
        fixture.guest,
      ).expect(404);

      expect(denied.body.code).toBe('CALENDAR_EVENT_NOT_FOUND');

      const empty = await planner(fixture, fixture.guest);

      expect(empty.events).toHaveLength(0);
    });
  });

  describe('Sprints', () => {
    async function createSprintFolder(fixture: Fixture): Promise<SprintFolderView> {
      const response = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/sprint-folders`),
        fixture.owner,
      )
        .send({
          spaceId: fixture.space.id,
          name: 'Sprints uSolutionsPDV',
          durationDays: 7,
          startDate: '2026-02-02T00:00:00.000Z',
        })
        .expect(201);

      return response.body as SprintFolderView;
    }

    it('cria a pasta com a primeira sprint e a próxima em sequência', async () => {
      const fixture = await setup();
      const created = await createSprintFolder(fixture);

      expect(created.sprints).toHaveLength(1);
      expect(created.sprints[0].name).toBe('Sprint 1');
      expect(created.sprints[0].startDate).toBe('2026-02-02T00:00:00.000Z');
      expect(created.sprints[0].endDate).toBe('2026-02-08T00:00:00.000Z');

      const next = await withAuth(
        http().post(
          `/api/v1/workspaces/${fixture.workspace.id}/sprint-folders/${created.sprintFolder.id}/sprints`,
        ),
        fixture.owner,
      )
        .send({})
        .expect(201);

      expect(next.body.name).toBe('Sprint 2');
      expect(next.body.startDate).toBe('2026-02-09T00:00:00.000Z');

      const folder = await withAuth(
        http().get(
          `/api/v1/workspaces/${fixture.workspace.id}/sprint-folders/${created.sprintFolder.id}`,
        ),
        fixture.owner,
      ).expect(200);

      expect(folder.body.sprints).toHaveLength(2);
    });

    it('fecha a sprint e move as pendências para a próxima', async () => {
      const fixture = await setup();
      const created = await createSprintFolder(fixture);
      const sprint = created.sprints[0];
      const done = await createTask(fixture, { name: 'Entregue' }, sprint.id);
      const pending = await createTask(fixture, { name: 'Pendente' }, sprint.id);

      await withAuth(
        http().patch(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${done.id}`),
        fixture.owner,
      )
        .send({ statusId: doneStatus(fixture).id })
        .expect(200);

      const closed = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/sprints/${sprint.id}/close`),
        fixture.owner,
      ).expect(200);

      expect(closed.body.moved).toBe(1);
      expect(closed.body.sprint.sprintClosedAt).not.toBeNull();

      const nextSprintId = closed.body.nextSprint.id as string;
      const moved = await tasksOf(fixture, nextSprintId);

      expect(moved.map((one) => one.id)).toEqual([pending.id]);

      const remaining = await tasksOf(fixture, sprint.id);

      expect(remaining.map((one) => one.id)).toEqual([done.id]);
    });

    it('recusa fechar a sprint para quem é convidado e 404 em uma List comum', async () => {
      const fixture = await setup();
      const created = await createSprintFolder(fixture);

      const denied = await withAuth(
        http().post(
          `/api/v1/workspaces/${fixture.workspace.id}/sprints/${created.sprints[0].id}/close`,
        ),
        fixture.guest,
      ).expect(403);

      expect(denied.body.code).toBe('FORBIDDEN_ROLE');

      const notSprint = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/sprints/${fixture.list.id}/close`),
        fixture.owner,
      ).expect(404);

      expect(notSprint.body.code).toBe('SPRINT_NOT_FOUND');
    });

    it('o burndown aceita sprintId e usa o ciclo da sprint', async () => {
      const fixture = await setup();
      const created = await createSprintFolder(fixture);
      const sprint = created.sprints[0];

      await createTask(fixture, { name: 'Tarefa A' }, sprint.id);
      await createTask(fixture, { name: 'Tarefa B' }, sprint.id);

      const dashboard = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/dashboards`),
        fixture.owner,
      )
        .send({
          name: 'Sprint atual',
          cards: [{ type: 'burndown', config: { sprintId: sprint.id } }],
        })
        .expect(201);

      const cardId = dashboard.body.cards[0].id as string;
      const data = await withAuth(
        http().post(
          `/api/v1/workspaces/${fixture.workspace.id}/dashboards/${dashboard.body.id}/cards/${cardId}/data`,
        ),
        fixture.owner,
      )
        .send({})
        .expect(200);

      expect(data.body.data.total).toBe(2);
      expect(data.body.data.days).toHaveLength(7);
      expect(data.body.data.remaining[0]).toBe(2);
    });
  });
});
