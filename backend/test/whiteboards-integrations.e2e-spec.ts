import request from 'supertest';
import { AddressInfo } from 'node:net';
import { IncomingMessage, Server, ServerResponse, createServer } from 'node:http';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CALENDAR_PROVIDER,
  ExternalCalendarEvent,
} from '../src/modules/calendar/calendar-provider';
import { CalendarSyncService } from '../src/modules/calendar/calendar-sync.service';
import { CalendarConnection } from '../src/modules/integrations/google/schemas/calendar-connection.schema';
import { WebhookDeliveryService } from '../src/modules/integrations/webhooks/webhook-delivery.service';
import { signBody, verifyBody } from '../src/modules/integrations/webhooks/webhook-signature';
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

interface TaskBody {
  id: string;
  customId: string;
  name: string;
  statusId: string;
}

interface WhiteboardElementBody {
  id: string;
  type: string;
  text: string | null;
  x: number;
  taskId: string | null;
}

interface WhiteboardBody extends IdBody {
  title: string;
  version: number;
  elements: WhiteboardElementBody[];
}

interface DeliveryBody extends IdBody {
  event: string;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  statusCode: number | null;
}

interface Fixture {
  owner: Session;
  ownerId: string;
  member: Session;
  guest: Session;
  workspace: IdBody;
  space: IdBody;
  list: IdBody;
  statuses: StatusBody[];
}

/** Request the local endpoint of the outgoing webhooks received. */
interface ReceivedHook {
  body: string;
  event: string | undefined;
  signature: string | undefined;
}

/** Provider of the Google Agenda, scripted by each test. */
const fakeCalendar = {
  source: 'google' as const,
  connected: false,
  pulled: [] as ExternalCalendarEvent[],
  pushed: [] as ExternalCalendarEvent[],
  removed: [] as string[],
  isConnected: (): Promise<boolean> => Promise.resolve(fakeCalendar.connected),
  pull: (): Promise<ExternalCalendarEvent[]> => Promise.resolve(fakeCalendar.pulled),
  push: (_range: unknown, event: ExternalCalendarEvent): Promise<string | null> => {
    fakeCalendar.pushed.push(event);

    return Promise.resolve(`google-${fakeCalendar.pushed.length}`);
  },
  remove: (_range: unknown, externalId: string): Promise<void> => {
    fakeCalendar.removed.push(externalId);

    return Promise.resolve();
  },
};

describe('Quadros e integrações', () => {
  let ctx: TestApp;
  let hookServer: Server;
  let hookUrl: string;
  let received: ReceivedHook[] = [];
  let hookStatuses: number[] = [];

  beforeAll(async () => {
    ctx = await createTestApp({
      overrides: [{ token: CALENDAR_PROVIDER, value: fakeCalendar }],
    });

    hookServer = createServer((req: IncomingMessage, res: ServerResponse) => {
      const chunks: Buffer[] = [];

      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        received.push({
          body: Buffer.concat(chunks).toString('utf8'),
          event: req.headers['x-azuos-event'] as string | undefined,
          signature: req.headers['x-azuos-signature-256'] as string | undefined,
        });
        res.statusCode = hookStatuses.shift() ?? 200;
        res.end();
      });
    });

    await new Promise<void>((resolve) => hookServer.listen(0, '127.0.0.1', resolve));
    hookUrl = `http://127.0.0.1:${(hookServer.address() as AddressInfo).port}/hook`;
  });

  beforeEach(() => {
    received = [];
    hookStatuses = [];
    fakeCalendar.connected = false;
    fakeCalendar.pulled = [];
    fakeCalendar.pushed = [];
    fakeCalendar.removed = [];
  });

  afterEach(async () => {
    await ctx.clearDatabase();
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => hookServer.close(() => resolve()));
    await ctx.close();
  });

  const http = (): request.Agent => request(ctx.httpServer as never);

  const withAuth = (test: request.Test, session: Session): request.Test =>
    test
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('X-Forwarded-For', session.credentials.ip);

  const withKey = (test: request.Test, token: string, ip: string): request.Test =>
    test.set('Authorization', `Bearer ${token}`).set('X-Forwarded-For', ip);

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
      member: await addMember(workspace, owner, 'member'),
      guest: await addMember(workspace, owner, 'guest'),
      workspace,
      space,
      list,
      statuses,
    };
  }

  async function createTask(fixture: Fixture, name = 'Ajustar PDV'): Promise<TaskBody> {
    const response = await withAuth(
      http().post(`/api/v1/workspaces/${fixture.workspace.id}/lists/${fixture.list.id}/tasks`),
      fixture.owner,
    )
      .send({ name })
      .expect(201);

    return response.body as TaskBody;
  }

  async function createBoard(fixture: Fixture): Promise<WhiteboardBody> {
    const response = await withAuth(
      http().post(`/api/v1/workspaces/${fixture.workspace.id}/whiteboards`),
      fixture.owner,
    )
      .send({
        locationType: 'list',
        locationId: fixture.list.id,
        title: 'Fluxo do PDV',
        elements: [{ id: 'n1', type: 'note', x: 0, y: 0, text: 'Subir versão' }],
      })
      .expect(201);

    return response.body as WhiteboardBody;
  }

  function statusNamed(fixture: Fixture, name: string): StatusBody {
    const status = fixture.statuses.find((one) => one.name === name);

    if (!status) {
      throw new Error(`O conjunto de status não tem "${name}".`);
    }

    return status;
  }

  async function waitFor<T>(load: () => Promise<T | null>, what: string): Promise<T> {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const value = await load();

      if (value) {
        return value;
      }

      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    throw new Error(`Tempo esgotado esperando ${what}.`);
  }

  describe('Quadros', () => {
    it('cria o quadro e aplica um lote de operações com a versão', async () => {
      const fixture = await setup();
      const board = await createBoard(fixture);

      expect(board.version).toBe(1);
      expect(board.elements).toHaveLength(1);

      const patched = await withAuth(
        http().patch(`/api/v1/workspaces/${fixture.workspace.id}/whiteboards/${board.id}/elements`),
        fixture.owner,
      )
        .send({
          version: board.version,
          ops: [
            { op: 'add', element: { id: 'n2', type: 'shape', x: 40, y: 10 } },
            { op: 'add', element: { id: 'c1', type: 'connector', from: 'n1', to: 'n2' } },
            { op: 'update', id: 'n1', element: { x: 7 } },
          ],
        })
        .expect(200);

      const updated = patched.body as WhiteboardBody;

      expect(updated.version).toBe(2);
      expect(updated.elements.map((element) => element.id)).toEqual(['n1', 'n2', 'c1']);
      expect(updated.elements[0].x).toBe(7);

      const removed = await withAuth(
        http().patch(`/api/v1/workspaces/${fixture.workspace.id}/whiteboards/${board.id}/elements`),
        fixture.owner,
      )
        .send({ version: updated.version, ops: [{ op: 'remove', id: 'c1' }] })
        .expect(200);

      expect((removed.body as WhiteboardBody).elements).toHaveLength(2);
    });

    it('responde 409 quando a versão divergiu', async () => {
      const fixture = await setup();
      const board = await createBoard(fixture);

      await withAuth(
        http().patch(`/api/v1/workspaces/${fixture.workspace.id}/whiteboards/${board.id}/elements`),
        fixture.owner,
      )
        .send({ version: 1, ops: [{ op: 'update', id: 'n1', element: { x: 5 } }] })
        .expect(200);

      const conflict = await withAuth(
        http().patch(`/api/v1/workspaces/${fixture.workspace.id}/whiteboards/${board.id}/elements`),
        fixture.owner,
      )
        .send({ version: 1, ops: [{ op: 'update', id: 'n1', element: { x: 9 } }] })
        .expect(409);

      expect(conflict.body.code).toBe('WHITEBOARD_VERSION_CONFLICT');
    });

    it('valida o elemento e esconde o quadro de quem não vê a List', async () => {
      const fixture = await setup();
      const board = await createBoard(fixture);

      const invalid = await withAuth(
        http().patch(`/api/v1/workspaces/${fixture.workspace.id}/whiteboards/${board.id}/elements`),
        fixture.owner,
      )
        .send({ version: 1, ops: [{ op: 'add', element: { type: 'hologram' } }] })
        .expect(400);

      expect(invalid.body.code).toBe('INVALID_WHITEBOARD_ELEMENT');

      const denied = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/whiteboards/${board.id}`),
        fixture.guest,
      ).expect(404);

      expect(denied.body.code).toBe('WHITEBOARD_NOT_FOUND');
    });

    it('converte um elemento em tarefa', async () => {
      const fixture = await setup();
      const board = await createBoard(fixture);

      const response = await withAuth(
        http().post(
          `/api/v1/workspaces/${fixture.workspace.id}/whiteboards/${board.id}/elements/n1/to-task`,
        ),
        fixture.owner,
      )
        .send({ listId: fixture.list.id })
        .expect(201);

      const task = response.body.task as TaskBody;
      const whiteboard = response.body.whiteboard as WhiteboardBody;

      expect(task.name).toBe('Subir versão');
      expect(task.customId).toMatch(/^AZD-\d+$/);
      expect(whiteboard.elements[0].taskId).toBe(task.id);
      expect(whiteboard.version).toBe(2);

      const missing = await withAuth(
        http().post(
          `/api/v1/workspaces/${fixture.workspace.id}/whiteboards/${board.id}/elements/ghost/to-task`,
        ),
        fixture.owner,
      )
        .send({ listId: fixture.list.id })
        .expect(404);

      expect(missing.body.code).toBe('WHITEBOARD_ELEMENT_NOT_FOUND');
    });
  });

  describe('GitHub', () => {
    const REPOSITORY = 'azuosdev/usolutionspdv';

    async function connectRepository(fixture: Fixture): Promise<string> {
      const response = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/integrations/github`),
        fixture.owner,
      )
        .send({ repository: REPOSITORY })
        .expect(201);

      expect(response.body.webhookUrl).toContain('/api/v1/integrations/github/webhook');

      return response.body.secret as string;
    }

    function pullRequestPayload(
      task: TaskBody,
      overrides: Record<string, unknown> = {},
    ): Record<string, unknown> {
      return {
        action: 'opened',
        repository: { full_name: REPOSITORY },
        pull_request: {
          number: 7,
          title: `${task.customId} ajusta o fechamento de caixa`,
          html_url: 'https://github.com/azuosdev/usolutionspdv/pull/7',
          merged: false,
          head: { ref: 'feature/caixa' },
          user: { login: 'felipe' },
          ...overrides,
        },
        ...(overrides.action ? { action: overrides.action } : {}),
      };
    }

    function postWebhook(body: Record<string, unknown>, secret: string | null): request.Test {
      const raw = JSON.stringify(body);
      const test = http()
        .post('/api/v1/integrations/github/webhook')
        .set('X-Forwarded-For', '10.90.0.1')
        .set('content-type', 'application/json')
        .set('x-github-event', 'pull_request');

      if (secret !== null) {
        test.set('x-hub-signature-256', signBody(raw, secret));
      }

      return test.send(raw);
    }

    async function taskOf(fixture: Fixture, task: TaskBody): Promise<TaskBody> {
      const response = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${task.id}`),
        fixture.owner,
      ).expect(200);

      return response.body as TaskBody;
    }

    it('recusa uma assinatura inválida com 401', async () => {
      const fixture = await setup();
      await connectRepository(fixture);
      const task = await createTask(fixture);

      const wrong = await postWebhook(pullRequestPayload(task), 'outro-segredo').expect(401);

      expect(wrong.body.code).toBe('INVALID_SIGNATURE');

      const missing = await postWebhook(pullRequestPayload(task), null).expect(401);

      expect(missing.body.code).toBe('INVALID_SIGNATURE');
    });

    it('move a tarefa para Code review e comenta com o link do PR', async () => {
      const fixture = await setup();
      const secret = await connectRepository(fixture);
      const task = await createTask(fixture);

      const response = await postWebhook(pullRequestPayload(task), secret).expect(200);

      expect(response.body).toMatchObject({
        received: true,
        customId: task.customId,
        outcome: 'review',
        statusChanged: true,
      });

      const reloaded = await taskOf(fixture, task);

      expect(reloaded.statusId).toBe(statusNamed(fixture, 'Code review').id);

      const comments = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${task.id}/comments`),
        fixture.owner,
      ).expect(200);

      expect(comments.body.items[0].comment.bodyText).toContain(
        'https://github.com/azuosdev/usolutionspdv/pull/7',
      );
    });

    it('move a tarefa para Deploy quando o PR é mesclado', async () => {
      const fixture = await setup();
      const secret = await connectRepository(fixture);
      const task = await createTask(fixture);

      const response = await postWebhook(
        pullRequestPayload(task, { action: 'closed', merged: true }),
        secret,
      ).expect(200);

      expect(response.body).toMatchObject({ outcome: 'deploy', statusChanged: true });
      expect((await taskOf(fixture, task)).statusId).toBe(statusNamed(fixture, 'Deploy').id);
    });

    it('ignora o evento sem tarefa citada e exige admin na configuração', async () => {
      const fixture = await setup();
      const secret = await connectRepository(fixture);
      const task = await createTask(fixture);

      const ignored = await postWebhook(
        pullRequestPayload(task, { title: 'sem referência', head: { ref: 'main' } }),
        secret,
      ).expect(200);

      expect(ignored.body).toMatchObject({ received: true, ignored: 'task-not-referenced' });

      const denied = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/integrations/github`),
        fixture.member,
      )
        .send({ repository: 'azuosdev/outro' })
        .expect(403);

      expect(denied.body.code).toBe('FORBIDDEN_ROLE');
    });

    it('responde 404 para um repositório desconhecido', async () => {
      const fixture = await setup();
      await connectRepository(fixture);

      const unknown = await http()
        .post('/api/v1/integrations/github/webhook')
        .set('X-Forwarded-For', '10.90.0.2')
        .set('content-type', 'application/json')
        .set('x-github-event', 'pull_request')
        .send(JSON.stringify({ repository: { full_name: 'outro/repo' }, pull_request: { id: 1 } }))
        .expect(404);

      expect(unknown.body.code).toBe('GITHUB_INTEGRATION_NOT_FOUND');
    });
  });

  describe('Webhooks de saída', () => {
    async function createWebhook(
      fixture: Fixture,
      events: string[] = ['task.created'],
    ): Promise<{ id: string; secret: string }> {
      const response = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/webhooks`),
        fixture.owner,
      )
        .send({ url: hookUrl, events })
        .expect(201);

      expect(response.body.webhook.secret).toBeUndefined();

      return { id: response.body.webhook.id as string, secret: response.body.secret as string };
    }

    async function deliveriesOf(fixture: Fixture, webhookId: string): Promise<DeliveryBody[]> {
      const response = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/webhooks/${webhookId}/deliveries`),
        fixture.owner,
      ).expect(200);

      return response.body.items as DeliveryBody[];
    }

    it('entrega assinado e repete depois de uma falha', async () => {
      const fixture = await setup();
      const webhook = await createWebhook(fixture);

      // The destination fails once, so the delivery stays pending with a backoff.
      hookStatuses = [500];

      const task = await createTask(fixture);
      const failed = await waitFor(async () => {
        const items = await deliveriesOf(fixture, webhook.id);

        return items.find((item) => item.attempts >= 1) ?? null;
      }, 'a primeira tentativa do webhook');

      expect(failed).toMatchObject({ event: 'task.created', status: 'pending', attempts: 1 });
      expect(received).toHaveLength(1);
      expect(received[0].event).toBe('task.created');
      expect(verifyBody(received[0].body, webhook.secret, received[0].signature)).toBe(true);
      expect(verifyBody(received[0].body, 'outro', received[0].signature)).toBe(false);

      const sent = JSON.parse(received[0].body) as { event: string; data: { taskId: string } };

      expect(sent.event).toBe('task.created');
      expect(sent.data.taskId).toBe(task.id);

      // The retry is due only after the backoff, so the cycle runs in the future.
      const retried = await ctx.app
        .get(WebhookDeliveryService)
        .runPending(new Date(Date.now() + 60_000));

      expect(retried).toBe(1);
      expect(received).toHaveLength(2);

      const settled = await deliveriesOf(fixture, webhook.id);

      expect(settled[0]).toMatchObject({ status: 'success', attempts: 2, statusCode: 200 });
    });

    it('reenvia a entrega e grava uma linha nova no log', async () => {
      const fixture = await setup();
      const webhook = await createWebhook(fixture);

      await createTask(fixture);

      const first = await waitFor(async () => {
        const items = await deliveriesOf(fixture, webhook.id);

        return items.find((item) => item.status === 'success') ?? null;
      }, 'a primeira entrega do webhook');

      expect(received).toHaveLength(1);

      const resent = await withAuth(
        http().post(
          `/api/v1/workspaces/${fixture.workspace.id}/webhooks/${webhook.id}/deliveries/${first.id}/redeliver`,
        ),
        fixture.owner,
      ).expect(200);

      expect(resent.body).toMatchObject({ event: 'task.created', status: 'success', attempts: 1 });
      expect(resent.body.id).not.toBe(first.id);
      expect(received).toHaveLength(2);
      expect(verifyBody(received[1].body, webhook.secret, received[1].signature)).toBe(true);

      const log = await deliveriesOf(fixture, webhook.id);

      expect(log).toHaveLength(2);

      // Entrega de outro workspace não existe para este.
      const unknown = await withAuth(
        http().post(
          `/api/v1/workspaces/${fixture.workspace.id}/webhooks/${webhook.id}/deliveries/${new Types.ObjectId().toString()}/redeliver`,
        ),
        fixture.owner,
      ).expect(404);

      expect(unknown.body.code).toBe('WEBHOOK_DELIVERY_NOT_FOUND');

      const denied = await withAuth(
        http().post(
          `/api/v1/workspaces/${fixture.workspace.id}/webhooks/${webhook.id}/deliveries/${first.id}/redeliver`,
        ),
        fixture.member,
      ).expect(403);

      expect(denied.body.code).toBe('FORBIDDEN_ROLE');

      const invalid = await withAuth(
        http().post(
          `/api/v1/workspaces/${fixture.workspace.id}/webhooks/${webhook.id}/deliveries/nao-e-id/redeliver`,
        ),
        fixture.owner,
      ).expect(400);

      expect(invalid.body.code).toBe('INVALID_ID');
    });

    it('não entrega evento fora da assinatura e respeita o admin', async () => {
      const fixture = await setup();
      const webhook = await createWebhook(fixture, ['whiteboard.updated']);

      await createTask(fixture);
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(await deliveriesOf(fixture, webhook.id)).toHaveLength(0);
      expect(received).toHaveLength(0);

      const denied = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/webhooks`),
        fixture.member,
      ).expect(403);

      expect(denied.body.code).toBe('FORBIDDEN_ROLE');
    });
  });

  describe('Chaves de API', () => {
    async function createKey(session: Session, scopes: string[]): Promise<string> {
      const response = await withAuth(http().post('/api/v1/users/me/api-keys'), session)
        .send({ name: 'Integração do site', scopes })
        .expect(201);

      expect(response.body.token).toMatch(/^azk_/);
      expect(response.body.apiKey.tokenHash).toBeUndefined();
      expect(response.body.apiKey.hint).toBe((response.body.token as string).slice(0, 12));

      return response.body.token as string;
    }

    it('lê com a chave read e recusa a escrita', async () => {
      const fixture = await setup();
      const token = await createKey(fixture.owner, ['read']);
      const ip = '10.91.0.1';

      const tasks = await withKey(
        http()
          .get(`/api/v1/workspaces/${fixture.workspace.id}/tasks/query`)
          .query({ location: 'list', locationId: fixture.list.id }),
        token,
        ip,
      ).expect(200);

      expect(tasks.body.items).toEqual([]);

      const denied = await withKey(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/lists/${fixture.list.id}/tasks`),
        token,
        ip,
      )
        .send({ name: 'Pela chave' })
        .expect(403);

      expect(denied.body.code).toBe('API_KEY_SCOPE_DENIED');
    });

    it('escreve com a chave write e para de valer quando revogada', async () => {
      const fixture = await setup();
      const token = await createKey(fixture.owner, ['read', 'write']);
      const ip = '10.91.0.2';

      const created = await withKey(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/lists/${fixture.list.id}/tasks`),
        token,
        ip,
      )
        .send({ name: 'Pela chave' })
        .expect(201);

      expect((created.body as TaskBody).customId).toMatch(/^AZD-\d+$/);

      const keys = await withAuth(http().get('/api/v1/users/me/api-keys'), fixture.owner).expect(
        200,
      );

      await withAuth(
        http().delete(`/api/v1/users/me/api-keys/${keys.body.items[0].id as string}`),
        fixture.owner,
      ).expect(200);

      const revoked = await withKey(http().get('/api/v1/auth/me'), token, ip).expect(401);

      expect(revoked.body.code).toBe('UNAUTHORIZED');

      await withKey(http().get('/api/v1/auth/me'), 'azk_desconhecida', ip).expect(401);
    });
  });

  describe('Google Agenda', () => {
    it('sincroniza nos dois sentidos com o provider mockado', async () => {
      const fixture = await setup();
      const from = '2026-03-02T00:00:00.000Z';
      const to = '2026-03-09T00:00:00.000Z';

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/calendar/events`),
        fixture.owner,
      )
        .send({
          title: 'Daily uSolutionsPDV',
          start: '2026-03-03T13:00:00.000Z',
          end: '2026-03-03T13:15:00.000Z',
        })
        .expect(201);

      fakeCalendar.connected = true;
      fakeCalendar.pulled = [
        {
          externalId: 'ext-1',
          title: 'Reunião com o cliente',
          start: new Date('2026-03-04T14:00:00.000Z'),
          end: new Date('2026-03-04T15:00:00.000Z'),
          allDay: false,
          meetUrl: 'https://meet.google.com/abc-defg-hij',
          recurrence: null,
        },
      ];

      const result = await ctx.app
        .get(CalendarSyncService)
        .syncOne(
          new Types.ObjectId(fixture.workspace.id),
          new Types.ObjectId(fixture.ownerId),
          new Date('2026-03-03T12:00:00.000Z'),
        );

      expect(result).toEqual({ pulled: 1, pushed: 1 });
      expect(fakeCalendar.pushed[0].title).toBe('Daily uSolutionsPDV');

      const events = await withAuth(
        http()
          .get(`/api/v1/workspaces/${fixture.workspace.id}/calendar/events`)
          .query({ from, to }),
        fixture.owner,
      ).expect(200);

      const items = events.body.items as {
        title: string;
        source: string;
        externalId: string | null;
      }[];
      const google = items.find((item) => item.source === 'google');
      const local = items.find((item) => item.source === 'local');

      expect(google).toMatchObject({ title: 'Reunião com o cliente', externalId: 'ext-1' });
      expect(local).toMatchObject({ title: 'Daily uSolutionsPDV', externalId: 'google-1' });

      // A second cycle neither duplicates the external event nor pushes again.
      const again = await ctx.app
        .get(CalendarSyncService)
        .syncOne(
          new Types.ObjectId(fixture.workspace.id),
          new Types.ObjectId(fixture.ownerId),
          new Date('2026-03-03T12:00:00.000Z'),
        );

      expect(again).toEqual({ pulled: 1, pushed: 0 });
      expect((events.body.items as unknown[]).length).toBe(2);
    });

    it('escolhe a agenda da conta conectada e recusa sem conexão', async () => {
      const fixture = await setup();
      const path = `/api/v1/workspaces/${fixture.workspace.id}/integrations/google`;

      const missing = await withAuth(http().get(`${path}/calendars`), fixture.owner).expect(404);

      expect(missing.body.code).toBe('CALENDAR_CONNECTION_NOT_FOUND');

      const refused = await withAuth(http().patch(path), fixture.owner)
        .send({ calendarId: 'equipe@azuos.dev' })
        .expect(404);

      expect(refused.body.code).toBe('CALENDAR_CONNECTION_NOT_FOUND');

      const connections = ctx.app.get<Model<CalendarConnection>>(
        getModelToken(CalendarConnection.name),
      );

      await connections.create({
        workspaceId: new Types.ObjectId(fixture.workspace.id),
        userId: new Types.ObjectId(fixture.ownerId),
        provider: 'google',
        email: 'dono@azuos.dev',
        accessToken: 'sem-valor',
        refreshToken: null,
        expiresAt: new Date(Date.now() + 3_600_000),
        calendarId: 'primary',
      });

      const chosen = await withAuth(http().patch(path), fixture.owner)
        .send({ calendarId: 'equipe@azuos.dev' })
        .expect(200);

      expect(chosen.body).toMatchObject({ connected: true, calendarId: 'equipe@azuos.dev' });

      const status = await withAuth(http().get(path), fixture.owner).expect(200);

      expect(status.body.calendarId).toBe('equipe@azuos.dev');

      const invalid = await withAuth(http().patch(path), fixture.owner)
        .send({ calendarId: '' })
        .expect(400);

      expect(invalid.body.code).toBe('VALIDATION_ERROR');

      // A conta conectada é de quem conectou: outro membro não vê a agenda.
      const other = await withAuth(http().get(`${path}/calendars`), fixture.member).expect(404);

      expect(other.body.code).toBe('CALENDAR_CONNECTION_NOT_FOUND');

      await connections
        .deleteMany({ workspaceId: new Types.ObjectId(fixture.workspace.id) })
        .exec();
    });

    it('não sincroniza quando a conta não está conectada', async () => {
      const fixture = await setup();

      const result = await ctx.app
        .get(CalendarSyncService)
        .syncOne(new Types.ObjectId(fixture.workspace.id), new Types.ObjectId(fixture.ownerId));

      expect(result).toEqual({ pulled: 0, pushed: 0 });

      const status = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/integrations/google`),
        fixture.owner,
      ).expect(200);

      expect(status.body).toMatchObject({ connected: false, available: false });

      const unavailable = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/integrations/google/auth-url`),
        fixture.owner,
      ).expect(400);

      expect(unavailable.body.code).toBe('INVALID_GOOGLE_INTEGRATION');
    });
  });
});
