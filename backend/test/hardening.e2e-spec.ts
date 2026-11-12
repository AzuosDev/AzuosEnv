import request from 'supertest';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification } from '../src/modules/notifications/schemas/notification.schema';
import { Task } from '../src/modules/tasks/schemas/task.schema';
import { Session, createSession } from './utils/auth-client';
import { TestApp, createTestApp } from './utils/e2e-app';

interface IdBody {
  id: string;
}

interface StatusBody {
  id: string;
  name: string;
  group: string;
}

interface Fixture {
  owner: Session;
  ownerId: string;
  admin: Session;
  member: Session;
  memberId: string;
  workspace: IdBody;
  space: IdBody;
  list: IdBody;
  statuses: StatusBody[];
}

interface AuditBody extends IdBody {
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown>;
}

interface ImportReportBody {
  rows: number;
  tasks: number;
  lists: number;
  folders: number;
  tags: number;
  skipped: { line: number; reason: string }[];
  warnings: { line: number; reason: string }[];
}

const CLICKUP_CSV = [
  'Task ID,Task Name,Task Content,Status,Priority,Assignees,Tags,Due Date,Start Date,Time Estimate,Points,List Name,Folder Name',
  '86a1,Corrigir sangria,"Caixa fecha errado, com virgula",A fazer,urgent,ASSIGNEE_EMAIL,"[pdv,caixa]",1771200000000,,14400000,3,Sprint 4,Cênio Construções',
  '86a2,Homologar TEF,,Status Inexistente,high,ninguem@fora.dev,tef,2026-03-10T12:00:00.000Z,,3h 30m,5,Sprint 4,Cênio Construções',
  '86a3,,Linha sem nome,A fazer,low,,,,,,,Sprint 4,',
  '86a4,Relatório de vendas,,,normal,,,,,,,Backlog geral,',
].join('\n');

/** Looks for the stage type inside the plan the server chose. */
function planOf(explained: unknown): string {
  const plan = (explained as { queryPlanner?: { winningPlan?: unknown } }).queryPlanner
    ?.winningPlan;

  return JSON.stringify(plan ?? explained);
}

describe('Hardening, auditoria e importação', () => {
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
    const admin = await addMember(workspace, owner, 'admin');
    const member = await addMember(workspace, owner, 'member');
    const memberMe = await withAuth(http().get('/api/v1/auth/me'), member).expect(200);

    return {
      owner,
      ownerId: me.body.id as string,
      admin,
      member,
      memberId: memberMe.body.id as string,
      workspace,
      space,
      list,
      statuses,
    };
  }

  /** Membership row of the member, the id the role routes take. */
  async function memberRowId(fixture: Fixture): Promise<string> {
    const members = await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/members`),
      fixture.owner,
    ).expect(200);

    const row = (members.body.items as { id: string; userId: { id: string } }[]).find(
      (item) => item.userId.id === fixture.memberId,
    );

    if (!row) {
      throw new Error('Membro não encontrado na listagem.');
    }

    return row.id;
  }

  describe('injeção de NoSQL', () => {
    it('remove chaves com $ e . de um campo Mixed e mantém o resto', async () => {
      const fixture = await setup();
      const created = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/views`),
        fixture.owner,
      )
        .send({
          locationType: 'list',
          locationId: fixture.list.id,
          type: 'board',
          name: 'Quadro',
          config: { options: { $where: 'sleep(1)', 'a.b': 1, manter: 'sim' } },
        })
        .expect(201);

      const view = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/views/${created.body.id}`),
        fixture.owner,
      ).expect(200);

      expect(view.body.config.options).toEqual({ manter: 'sim' });
    });

    it('não deixa um operador no lugar do e-mail virar login', async () => {
      await http()
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '10.90.0.1')
        .send({ email: { $ne: null }, password: { $ne: null } })
        .expect(400);
    });
  });

  describe('audit_logs', () => {
    it('registra a troca de papel, o expurgo e a integração, e lista para o admin', async () => {
      const fixture = await setup();
      const rowId = await memberRowId(fixture);

      await withAuth(
        http().patch(`/api/v1/workspaces/${fixture.workspace.id}/members/${rowId}`),
        fixture.owner,
      )
        .send({ role: 'limited' })
        .expect(200);

      const task = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/lists/${fixture.list.id}/tasks`),
        fixture.owner,
      )
        .send({ name: 'Apagar de vez' })
        .expect(201);

      await withAuth(
        http().delete(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${task.body.id}`),
        fixture.owner,
      ).expect(200);
      await withAuth(
        http().delete(`/api/v1/workspaces/${fixture.workspace.id}/trash/task/${task.body.id}`),
        fixture.owner,
      ).expect(200);

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/integrations/github`),
        fixture.owner,
      )
        .send({ repository: 'azuos/usolutions-pdv', secret: 'segredo-do-webhook' })
        .expect(201);

      const logs = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/audit-logs`),
        fixture.admin,
      ).expect(200);

      const actions = (logs.body.items as AuditBody[]).map((item) => item.action);

      expect(actions).toEqual(
        expect.arrayContaining([
          'member.role.changed',
          'resource.purged',
          'integration.github.created',
        ]),
      );

      const integrationLog = (logs.body.items as AuditBody[]).find(
        (item) => item.action === 'integration.github.created',
      );

      expect(integrationLog?.entityType).toBe('integration');
      expect(integrationLog?.details).toHaveProperty('method', 'POST');
      expect(JSON.stringify(integrationLog?.details)).not.toContain('segredo-do-webhook');
      expect(JSON.stringify(integrationLog?.details)).toContain('[redacted]');
      expect(JSON.stringify(integrationLog?.details)).toContain('azuos/usolutions-pdv');
    });

    it('filtra por ação e responde 403 para quem não é admin', async () => {
      const fixture = await setup();
      const rowId = await memberRowId(fixture);

      const denied = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/audit-logs`),
        fixture.member,
      ).expect(403);

      expect(denied.body.code).toBe('FORBIDDEN_ROLE');

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/members/${rowId}/deactivate`),
        fixture.owner,
      ).expect(200);

      const filtered = await withAuth(
        http().get(
          `/api/v1/workspaces/${fixture.workspace.id}/audit-logs?action=member.deactivated`,
        ),
        fixture.owner,
      ).expect(200);

      expect(filtered.body.items).toHaveLength(1);
      expect((filtered.body.items as AuditBody[])[0].entityId).toBe(rowId);
    });

    it('recusa uma ação desconhecida no filtro', async () => {
      const fixture = await setup();

      await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/audit-logs?action=nao-existe`),
        fixture.owner,
      ).expect(400);
    });
  });

  describe('importação do ClickUp', () => {
    it('recria Folder, Lists, statuses, tags e responsáveis e relata o que ignorou', async () => {
      const fixture = await setup();
      const csv = CLICKUP_CSV.replace('ASSIGNEE_EMAIL', fixture.member.credentials.email);
      const response = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/import/clickup`),
        fixture.owner,
      )
        .field('spaceId', fixture.space.id)
        .attach('file', Buffer.from(csv, 'utf8'), 'clickup.csv')
        .expect(201);

      const report = response.body as ImportReportBody;

      expect(report.tasks).toBe(3);
      expect(report.lists).toBe(2);
      expect(report.folders).toBe(1);
      expect(report.tags).toBe(3);
      expect(report.skipped).toEqual([{ line: 4, reason: 'LINHA SEM NOME DE TAREFA' }]);
      expect(report.warnings).toEqual(
        expect.arrayContaining([
          { line: 3, reason: 'STATUS DESCONHECIDO: Status Inexistente' },
          { line: 3, reason: 'RESPONSAVEL SEM CONTA: ninguem@fora.dev' },
        ]),
      );

      const tasks = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/tasks/query?includeClosed=true`),
        fixture.owner,
      ).expect(200);

      const imported = (tasks.body.items as { name: string; customId: string }[]).map(
        (task) => task.name,
      );

      expect(imported).toEqual(
        expect.arrayContaining(['Corrigir sangria', 'Homologar TEF', 'Relatório de vendas']),
      );

      const sangria = (
        tasks.body.items as {
          name: string;
          priority: string | null;
          estimateMinutes: number | null;
          points: number | null;
          assigneeIds: string[];
          tagIds: string[];
          dueAt: string | null;
        }[]
      ).find((task) => task.name === 'Corrigir sangria');

      expect(sangria?.priority).toBe('urgent');
      expect(sangria?.estimateMinutes).toBe(240);
      expect(sangria?.points).toBe(3);
      expect(sangria?.assigneeIds).toEqual([fixture.memberId]);
      expect(sangria?.tagIds).toHaveLength(2);
      expect(sangria?.dueAt).toBe('2026-02-16T00:00:00.000Z');
    });

    it('exige o arquivo', async () => {
      const fixture = await setup();
      const response = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/import/clickup`),
        fixture.owner,
      )
        .field('spaceId', fixture.space.id)
        .expect(400);

      expect(response.body.code).toBe('FILE_REQUIRED');
    });

    it('responde 403 para quem não é admin', async () => {
      const fixture = await setup();
      const response = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/import/clickup`),
        fixture.member,
      )
        .field('spaceId', fixture.space.id)
        .attach('file', Buffer.from('Task Name\nX\n', 'utf8'), 'clickup.csv')
        .expect(403);

      expect(response.body.code).toBe('FORBIDDEN_ROLE');
    });
  });

  describe('exportação do workspace', () => {
    it('devolve o workspace inteiro em JSON, sem segredos', async () => {
      const fixture = await setup();

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/lists/${fixture.list.id}/tasks`),
        fixture.owner,
      )
        .send({ name: 'Exportar isto' })
        .expect(201);
      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/webhooks`),
        fixture.owner,
      )
        .send({ url: 'https://exemplo.azuos.dev/hook', events: ['*'] })
        .expect(201);

      const response = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/export`),
        fixture.owner,
      ).expect(200);

      expect(response.body.version).toBe(1);
      expect(response.body.workspace.taskPrefix).toBe('AZD');
      expect(response.body.collections.tasks).toHaveLength(1);
      expect(response.body.collections.tasks[0].name).toBe('Exportar isto');
      expect(response.body.collections.lists).toHaveLength(1);
      expect(response.body.collections.outgoing_webhooks[0]).not.toHaveProperty('secret');
      expect(response.body.users[0]).not.toHaveProperty('passwordHash');
      expect(response.body.truncated).toEqual([]);
    });

    it('responde 403 para quem não é admin', async () => {
      const fixture = await setup();
      const response = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/export`),
        fixture.member,
      ).expect(403);

      expect(response.body.code).toBe('FORBIDDEN_ROLE');
    });

    it('responde 404 para um workspace de que não participo', async () => {
      const outsider = await createSession(ctx);

      await withAuth(
        http().get(`/api/v1/workspaces/${new Types.ObjectId().toString()}/export`),
        outsider,
      ).expect(404);
    });
  });

  describe('índices das consultas principais', () => {
    it('a query de tarefas, o inbox e a busca usam índice', async () => {
      const workspaceId = new Types.ObjectId();
      const userId = new Types.ObjectId();
      const tasks = ctx.app.get<Model<Task>>(getModelToken(Task.name));
      const notifications = ctx.app.get<Model<Notification>>(getModelToken(Notification.name));

      await tasks.init();
      await notifications.init();

      const taskQuery = planOf(
        await tasks
          .find({
            workspaceId,
            listIds: { $in: [new Types.ObjectId()] },
            deletedAt: null,
            archivedAt: null,
            parentTaskId: null,
            statusGroup: { $nin: ['done', 'closed'] },
          })
          .explain('queryPlanner'),
      );

      expect(taskQuery).toContain('IXSCAN');
      expect(taskQuery).not.toContain('COLLSCAN');

      const myTasks = planOf(
        await tasks
          .find({
            workspaceId,
            listIds: { $in: [new Types.ObjectId()] },
            assigneeIds: userId,
            deletedAt: null,
            archivedAt: null,
          })
          .sort({ dueAt: 1, position: 1 })
          .explain('queryPlanner'),
      );

      expect(myTasks).toContain('IXSCAN');
      expect(myTasks).not.toContain('COLLSCAN');

      const inbox = planOf(
        await notifications
          .find({
            workspaceId,
            userId,
            bucket: 'primary',
            clearedAt: null,
            $or: [{ snoozedUntil: null }, { snoozedUntil: { $lte: new Date() } }],
          })
          .sort({ _id: -1 })
          .explain('queryPlanner'),
      );

      expect(inbox).toContain('IXSCAN');
      expect(inbox).not.toContain('COLLSCAN');

      const search = planOf(
        await tasks.find({ workspaceId, $text: { $search: 'pdv' } }).explain('queryPlanner'),
      );

      expect(search).toContain('TEXT_MATCH');
    });
  });

  describe('health', () => {
    it('informa o estado do banco', async () => {
      const response = await http().get('/api/v1/health').expect(200);

      expect(response.body).toEqual({ status: 'ok', db: 'up' });
    });

    it('devolve o requestId que o cliente enviou', async () => {
      const response = await http()
        .get('/api/v1/health')
        .set('x-request-id', 'azuos-teste-1')
        .expect(200);

      expect(response.headers['x-request-id']).toBe('azuos-teste-1');
    });
  });
});
