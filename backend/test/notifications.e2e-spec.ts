import request from 'supertest';
import { NotificationsScheduler } from '../src/modules/notifications/notifications.scheduler';
import { RemindersService } from '../src/modules/notifications/reminders.service';
import { Session, createSession } from './utils/auth-client';
import { TestApp, createTestApp } from './utils/e2e-app';

interface WorkspaceBody {
  id: string;
}

interface SpaceBody {
  id: string;
}

interface ListBody {
  id: string;
}

interface StatusBody {
  id: string;
  group: 'notStarted' | 'active' | 'done' | 'closed';
}

interface TaskBody {
  id: string;
  customId: string;
}

interface NotificationBody {
  id: string;
  type: string;
  bucket: 'primary' | 'other';
  entityType: string;
  entityId: string;
  actorId: string | null;
  readAt: string | null;
  snoozedUntil: string | null;
  clearedAt: string | null;
  data: Record<string, unknown>;
}

interface CountsBody {
  primary: number;
  other: number;
  later: number;
  cleared: number;
  unread: number;
}

interface ReminderBody {
  id: string;
  text: string;
  remindAt: string;
  recurrence: string;
  taskId: string | null;
  doneAt: string | null;
}

interface MemberFixture {
  session: Session;
  userId: string;
}

interface Fixture {
  owner: Session;
  ownerId: string;
  member: MemberFixture;
  workspace: WorkspaceBody;
  list: ListBody;
  statuses: StatusBody[];
}

describe('Inbox, lembretes e notificações', () => {
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
    workspace: WorkspaceBody,
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
    const ownerId = (await withAuth(http().get('/api/v1/auth/me'), owner).expect(200)).body
      .id as string;
    const workspace = (
      await withAuth(http().post('/api/v1/workspaces'), owner)
        .send({ name: 'Azuos Dev' })
        .expect(201)
    ).body as WorkspaceBody;
    const space = (
      await withAuth(http().post(`/api/v1/workspaces/${workspace.id}/spaces`), owner)
        .send({ name: 'Clientes' })
        .expect(201)
    ).body as SpaceBody;
    const list = (
      await withAuth(http().post(`/api/v1/workspaces/${workspace.id}/lists`), owner)
        .send({ spaceId: space.id, name: 'uSolutionsPDV — Sprint 3' })
        .expect(201)
    ).body as ListBody;
    const statuses = (
      await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/lists/${list.id}/statuses`),
        owner,
      ).expect(200)
    ).body.statuses as StatusBody[];
    const member = await addMember(workspace, owner, 'member');

    return { owner, ownerId, member, workspace, list, statuses };
  }

  function createTask(
    fixture: Fixture,
    session: Session,
    body: Record<string, unknown>,
  ): request.Test {
    return withAuth(
      http().post(`/api/v1/workspaces/${fixture.workspace.id}/lists/${fixture.list.id}/tasks`),
      session,
    ).send(body);
  }

  async function inbox(
    fixture: Fixture,
    session: Session,
    tab = 'primary',
  ): Promise<NotificationBody[]> {
    const response = await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/inbox?tab=${tab}`),
      session,
    ).expect(200);

    return response.body.items as NotificationBody[];
  }

  /** The listeners run after the response, so the inbox is read until it settles. */
  async function waitForType(
    fixture: Fixture,
    session: Session,
    type: string,
    tab = 'primary',
  ): Promise<NotificationBody[]> {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const found = (await inbox(fixture, session, tab)).filter((one) => one.type === type);

      if (found.length > 0) {
        return found;
      }

      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    return [];
  }

  async function ofType(
    fixture: Fixture,
    session: Session,
    type: string,
    tab = 'primary',
  ): Promise<NotificationBody[]> {
    return (await inbox(fixture, session, tab)).filter((one) => one.type === type);
  }

  describe('notificações de tarefa', () => {
    it('notifica só o atribuído quando a tarefa é criada', async () => {
      const fixture = await setup();

      const task = (
        await createTask(fixture, fixture.owner, {
          name: 'Corrigir fechamento de caixa',
          assigneeIds: [fixture.member.userId],
        }).expect(201)
      ).body as TaskBody;

      const notifications = await waitForType(fixture, fixture.member.session, 'assigned');

      expect(notifications).toHaveLength(1);
      expect(notifications[0].entityId).toBe(task.id);
      expect(notifications[0].bucket).toBe('primary');
      expect(notifications[0].data.customId).toBe(task.customId);
      expect(await ofType(fixture, fixture.owner, 'assigned')).toHaveLength(0);
    });

    it('não notifica o autor que se atribui', async () => {
      const fixture = await setup();

      await createTask(fixture, fixture.owner, {
        name: 'Revisar PR',
        assigneeIds: [fixture.ownerId],
      }).expect(201);

      // Gives the listener the same window used by waitForType before asserting the absence.
      await waitForType(fixture, fixture.member.session, 'assigned');

      expect(await ofType(fixture, fixture.owner, 'assigned')).toHaveLength(0);
    });

    it('notifica o atribuído adicionado no PATCH', async () => {
      const fixture = await setup();
      const task = (
        await createTask(fixture, fixture.owner, { name: 'Ajustar relatório' }).expect(201)
      ).body as TaskBody;

      await withAuth(
        http().patch(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${task.id}`),
        fixture.owner,
      )
        .send({ assigneeIds: [fixture.member.userId] })
        .expect(200);

      expect(await waitForType(fixture, fixture.member.session, 'assigned')).toHaveLength(1);
    });

    it('avisa o responsável quando o status muda', async () => {
      const fixture = await setup();
      const task = (
        await createTask(fixture, fixture.owner, {
          name: 'Subir build',
          assigneeIds: [fixture.member.userId],
        }).expect(201)
      ).body as TaskBody;
      const next = fixture.statuses.find((status) => status.group === 'active');

      await withAuth(
        http().patch(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${task.id}`),
        fixture.owner,
      )
        .send({ statusId: next?.id })
        .expect(200);

      expect(await waitForType(fixture, fixture.member.session, 'statusChanged')).toHaveLength(1);
    });

    it('notifica quem foi mencionado no comentário', async () => {
      const fixture = await setup();
      const task = (await createTask(fixture, fixture.owner, { name: 'Checar fila' }).expect(201))
        .body as TaskBody;

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${task.id}/comments`),
        fixture.owner,
      )
        .send({
          bodyText: 'Olha isso',
          body: {
            type: 'doc',
            content: [{ type: 'mention', attrs: { id: fixture.member.userId } }],
          },
        })
        .expect(201);

      expect(await waitForType(fixture, fixture.member.session, 'mentioned')).toHaveLength(1);
    });
  });

  describe('abas do inbox', () => {
    it('adiar tira a notificação da aba principal', async () => {
      const fixture = await setup();

      await createTask(fixture, fixture.owner, {
        name: 'Corrigir fechamento de caixa',
        assigneeIds: [fixture.member.userId],
      }).expect(201);

      const [notification] = await waitForType(fixture, fixture.member.session, 'assigned');
      const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/inbox/${notification.id}/snooze`),
        fixture.member.session,
      )
        .send({ until })
        .expect(201);

      expect(await ofType(fixture, fixture.member.session, 'assigned')).toHaveLength(0);
      expect(await ofType(fixture, fixture.member.session, 'assigned', 'later')).toHaveLength(1);
    });

    it('conta, marca todas como lidas e limpa', async () => {
      const fixture = await setup();

      await createTask(fixture, fixture.owner, {
        name: 'Corrigir fechamento de caixa',
        assigneeIds: [fixture.member.userId],
      }).expect(201);

      const [notification] = await waitForType(fixture, fixture.member.session, 'assigned');
      const countsUrl = `/api/v1/workspaces/${fixture.workspace.id}/inbox/counts`;
      const before = (await withAuth(http().get(countsUrl), fixture.member.session).expect(200))
        .body as CountsBody;

      expect(before.unread).toBeGreaterThanOrEqual(1);

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/inbox/read-all`),
        fixture.member.session,
      ).expect(201);

      const afterRead = (await withAuth(http().get(countsUrl), fixture.member.session).expect(200))
        .body as CountsBody;

      expect(afterRead.unread).toBe(0);

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/inbox/${notification.id}/clear`),
        fixture.member.session,
      ).expect(201);

      expect(await ofType(fixture, fixture.member.session, 'assigned')).toHaveLength(0);
      expect(await ofType(fixture, fixture.member.session, 'assigned', 'cleared')).toHaveLength(1);
    });

    it('não devolve a notificação de outro usuário', async () => {
      const fixture = await setup();

      await createTask(fixture, fixture.owner, {
        name: 'Corrigir fechamento de caixa',
        assigneeIds: [fixture.member.userId],
      }).expect(201);

      const [notification] = await waitForType(fixture, fixture.member.session, 'assigned');

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/inbox/${notification.id}/read`),
        fixture.owner,
      ).expect(404);
    });
  });

  describe('preferências', () => {
    it('desligar o inbox do tipo impede a notificação', async () => {
      const fixture = await setup();

      await withAuth(http().patch('/api/v1/users/me/notification-settings'), fixture.member.session)
        .send({ types: { assigned: { inbox: false } } })
        .expect(200);

      const settings = (
        await withAuth(
          http().get('/api/v1/users/me/notification-settings'),
          fixture.member.session,
        ).expect(200)
      ).body as Record<string, { inbox: boolean; email: boolean }>;

      expect(settings.assigned).toEqual({ inbox: false, email: false });
      expect(settings.mentioned).toEqual({ inbox: true, email: false });

      await createTask(fixture, fixture.owner, {
        name: 'Corrigir fechamento de caixa',
        assigneeIds: [fixture.member.userId],
      }).expect(201);

      expect(await waitForType(fixture, fixture.member.session, 'assigned')).toHaveLength(0);
    });
  });

  describe('datas e lembretes', () => {
    it('gera dueSoon uma única vez para a mesma data', async () => {
      const fixture = await setup();
      const scheduler = ctx.app.get(NotificationsScheduler);

      await createTask(fixture, fixture.owner, {
        name: 'Entregar sprint',
        assigneeIds: [fixture.member.userId],
        dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      }).expect(201);

      await scheduler.runDueDates();
      await scheduler.runDueDates();

      expect(await ofType(fixture, fixture.member.session, 'dueSoon')).toHaveLength(1);
      expect(await ofType(fixture, fixture.member.session, 'overdue')).toHaveLength(0);
    });

    it('gera overdue para tarefa aberta com data passada', async () => {
      const fixture = await setup();
      const scheduler = ctx.app.get(NotificationsScheduler);

      await createTask(fixture, fixture.owner, {
        name: 'Entregar sprint',
        assigneeIds: [fixture.member.userId],
        dueAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      }).expect(201);

      await scheduler.runDueDates();

      expect(await ofType(fixture, fixture.member.session, 'overdue')).toHaveLength(1);
    });

    it('cria, lista e entrega o lembrete', async () => {
      const fixture = await setup();
      const url = `/api/v1/workspaces/${fixture.workspace.id}/reminders`;
      const reminder = (
        await withAuth(http().post(url), fixture.member.session)
          .send({
            text: 'Falar com o cliente',
            remindAt: new Date(Date.now() - 1000).toISOString(),
          })
          .expect(201)
      ).body as ReminderBody;

      const pending = (
        await withAuth(http().get(`${url}?status=pending`), fixture.member.session).expect(200)
      ).body.items as ReminderBody[];

      expect(pending.map((one) => one.id)).toEqual([reminder.id]);

      await ctx.app.get(RemindersService).deliverDue();

      expect(await ofType(fixture, fixture.member.session, 'reminder')).toHaveLength(1);

      const done = (
        await withAuth(http().get(`${url}?status=done`), fixture.member.session).expect(200)
      ).body.items as ReminderBody[];

      expect(done).toHaveLength(1);
      expect(done[0].doneAt).not.toBeNull();
    });

    it('reagenda o lembrete recorrente em vez de concluir', async () => {
      const fixture = await setup();
      const url = `/api/v1/workspaces/${fixture.workspace.id}/reminders`;
      const remindAt = new Date(Date.now() - 1000);

      await withAuth(http().post(url), fixture.member.session)
        .send({ text: 'Daily', remindAt: remindAt.toISOString(), recurrence: 'daily' })
        .expect(201);

      await ctx.app.get(RemindersService).deliverDue();

      const pending = (await withAuth(http().get(url), fixture.member.session).expect(200)).body
        .items as ReminderBody[];

      expect(pending).toHaveLength(1);
      expect(new Date(pending[0].remindAt).getTime()).toBeGreaterThan(remindAt.getTime());
    });

    it('não devolve o lembrete de outro usuário', async () => {
      const fixture = await setup();
      const url = `/api/v1/workspaces/${fixture.workspace.id}/reminders`;
      const reminder = (
        await withAuth(http().post(url), fixture.member.session)
          .send({ text: 'Falar com o cliente', remindAt: new Date().toISOString() })
          .expect(201)
      ).body as ReminderBody;

      await withAuth(http().get(`${url}/${reminder.id}`), fixture.owner).expect(404);
      await withAuth(http().delete(`${url}/${reminder.id}`), fixture.owner).expect(404);
      await withAuth(http().delete(`${url}/${reminder.id}`), fixture.member.session).expect(200);
    });

    it('recusa lembrete sem data válida', async () => {
      const fixture = await setup();

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/reminders`),
        fixture.member.session,
      )
        .send({ text: 'Sem data', remindAt: 'ontem' })
        .expect(400);
    });
  });
});
