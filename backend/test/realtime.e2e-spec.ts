import request from 'supertest';
import { Socket, io } from 'socket.io-client';
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

interface TaskBody {
  id: string;
  customId: string;
}

interface RoomAck {
  joined?: string;
  left?: string;
  code?: string;
}

interface Fixture {
  owner: Session;
  workspace: WorkspaceBody;
  list: ListBody;
  task: TaskBody;
}

const WAIT_MS = 5000;

describe('Tempo real (Socket.IO)', () => {
  let ctx: TestApp;
  const clients: Socket[] = [];

  beforeAll(async () => {
    ctx = await createTestApp({ listen: true });
  });

  afterEach(async () => {
    for (const client of clients.splice(0)) {
      client.disconnect();
    }
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

  async function setup(): Promise<Fixture> {
    const owner = await createSession(ctx);
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
    const task = (
      await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/lists/${list.id}/tasks`),
        owner,
      )
        .send({ name: 'Corrigir fechamento de caixa' })
        .expect(201)
    ).body as TaskBody;

    return { owner, workspace, list, task };
  }

  function connect(token?: string): Socket {
    const client = io(ctx.baseUrl as string, {
      path: '/ws',
      transports: ['websocket'],
      auth: token ? { token } : {},
      reconnection: false,
    });

    clients.push(client);

    return client;
  }

  function connected(client: Socket): Promise<void> {
    return new Promise((resolve, reject) => {
      client.on('connect', () => resolve());
      client.on('connect_error', (error: Error) => reject(error));
    });
  }

  function join(client: Socket, payload: Record<string, string>): Promise<RoomAck> {
    return client.emitWithAck('join', payload) as Promise<RoomAck>;
  }

  function nextEvent<T>(client: Socket, event: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Sem evento ${event}`)), WAIT_MS);

      client.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  it('recusa o handshake sem token', async () => {
    await setup();
    const client = connect();

    await expect(connected(client)).rejects.toThrow('UNAUTHORIZED');
  });

  it('recusa o handshake com token inválido', async () => {
    await setup();
    const client = connect('nao-e-um-token');

    await expect(connected(client)).rejects.toThrow('UNAUTHORIZED');
  });

  it('entrega task.updated na sala da List', async () => {
    const fixture = await setup();
    const client = connect(fixture.owner.accessToken);

    await connected(client);

    await expect(
      join(client, { room: 'list', id: fixture.list.id, wsId: fixture.workspace.id }),
    ).resolves.toEqual({ joined: `list:${fixture.list.id}` });

    const received = nextEvent<Record<string, unknown>>(client, 'task.updated');

    await withAuth(
      http().patch(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${fixture.task.id}`),
      fixture.owner,
    )
      .send({ name: 'Corrigir fechamento de caixa (v2)' })
      .expect(200);

    const payload = await received;

    expect(payload.taskId).toBe(fixture.task.id);
    expect(payload.listId).toBe(fixture.list.id);
    expect(payload.changes).toMatchObject({ name: { to: 'Corrigir fechamento de caixa (v2)' } });
  });

  it('entrega notification.new na sala do usuário', async () => {
    const fixture = await setup();
    const invited = await createSession(ctx);
    const invite = await withAuth(
      http().post(`/api/v1/workspaces/${fixture.workspace.id}/invites`),
      fixture.owner,
    )
      .send({ email: invited.credentials.email, role: 'member' })
      .expect(201);
    const memberId = (
      await http()
        .post('/api/v1/invites/accept')
        .set('X-Forwarded-For', invited.credentials.ip)
        .send({ token: invite.body.token })
        .expect(200)
    ).body.member.userId as string;

    const client = connect(invited.accessToken);

    await connected(client);

    const received = nextEvent<Record<string, unknown>>(client, 'notification.new');

    await withAuth(
      http().patch(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${fixture.task.id}`),
      fixture.owner,
    )
      .send({ assigneeIds: [memberId] })
      .expect(200);

    const payload = await received;

    expect(payload.type).toBe('assigned');
    expect(payload.entityId).toBe(fixture.task.id);
  });

  it('publica presence:update na sala da tarefa', async () => {
    const fixture = await setup();
    const client = connect(fixture.owner.accessToken);

    await connected(client);

    const presence = nextEvent<{ taskId: string; userIds: string[] }>(client, 'presence:update');

    await join(client, { room: 'task', id: fixture.task.id, wsId: fixture.workspace.id });

    const payload = await presence;

    expect(payload.taskId).toBe(fixture.task.id);
    expect(payload.userIds).toHaveLength(1);
  });

  it('nega a sala de uma List invisível', async () => {
    const fixture = await setup();
    const outsider = await createSession(ctx);
    const client = connect(outsider.accessToken);

    await connected(client);

    await expect(
      join(client, { room: 'list', id: fixture.list.id, wsId: fixture.workspace.id }),
    ).resolves.toEqual({ code: 'FORBIDDEN_ROOM' });
  });
});
