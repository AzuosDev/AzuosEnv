import request from 'supertest';
import { Socket, io } from 'socket.io-client';
import { Session, createSession } from './utils/auth-client';
import { TestApp, createTestApp } from './utils/e2e-app';

interface IdBody {
  id: string;
}

interface ChannelBody extends IdBody {
  type: string;
  name: string;
  private: boolean;
  memberIds: string[];
  archivedAt: string | null;
}

interface MessageBody extends IdBody {
  bodyText: string;
  parentMessageId: string | null;
  replyCount: number;
  lastReplyAt: string | null;
  reactions: { emoji: string; userIds: string[] }[];
  editedAt: string | null;
}

interface ChatActivityBody {
  items: { channelId: string; unread: number; lastMessageAt: string | null }[];
  unread: number;
}

interface Fixture {
  owner: Session;
  ownerId: string;
  member: Session;
  memberId: string;
  outsider: Session;
  workspace: IdBody;
  space: IdBody;
  list: IdBody;
}

const WAIT_MS = 5000;

describe('Chat (canais, DMs e threads)', () => {
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

  async function joinWorkspace(
    workspaceId: string,
    owner: Session,
    invited: Session,
  ): Promise<string> {
    const invite = await withAuth(http().post(`/api/v1/workspaces/${workspaceId}/invites`), owner)
      .send({ email: invited.credentials.email, role: 'member' })
      .expect(201);

    const accepted = await http()
      .post('/api/v1/invites/accept')
      .set('X-Forwarded-For', invited.credentials.ip)
      .send({ token: invite.body.token })
      .expect(200);

    return accepted.body.member.userId as string;
  }

  async function setup(): Promise<Fixture> {
    const owner = await createSession(ctx);
    const member = await createSession(ctx);
    const outsider = await createSession(ctx);
    const workspace = (
      await withAuth(http().post('/api/v1/workspaces'), owner)
        .send({ name: 'Azuos Dev' })
        .expect(201)
    ).body as IdBody;
    const ownerId = (await withAuth(http().get('/api/v1/auth/me'), owner).expect(200)).body
      .id as string;
    const memberId = await joinWorkspace(workspace.id, owner, member);
    const outsiderId = await joinWorkspace(workspace.id, owner, outsider);
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

    expect(outsiderId).toBeDefined();

    return { owner, ownerId, member, memberId, outsider, workspace, space, list };
  }

  function createChannel(
    fixture: Fixture,
    body: Record<string, unknown>,
    session: Session = fixture.owner,
  ): request.Test {
    return withAuth(
      http().post(`/api/v1/workspaces/${fixture.workspace.id}/channels`),
      session,
    ).send(body);
  }

  function sendMessage(
    fixture: Fixture,
    channelId: string,
    body: Record<string, unknown>,
    session: Session = fixture.owner,
  ): request.Test {
    return withAuth(
      http().post(`/api/v1/workspaces/${fixture.workspace.id}/channels/${channelId}/messages`),
      session,
    ).send(body);
  }

  function connect(token: string): Socket {
    const client = io(ctx.baseUrl as string, {
      path: '/ws',
      transports: ['websocket'],
      auth: { token },
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

  function nextEvent<T>(client: Socket, event: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Sem evento ${event}`)), WAIT_MS);

      client.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  describe('canais', () => {
    it('cria um canal no Space e lista para os membros', async () => {
      const fixture = await setup();
      const channel = (
        await createChannel(fixture, {
          name: 'uSolutionsPDV',
          locationType: 'space',
          locationId: fixture.space.id,
        }).expect(201)
      ).body as ChannelBody;

      expect(channel.type).toBe('channel');
      expect(channel.memberIds).toEqual([fixture.ownerId]);

      const listed = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/channels`),
        fixture.member,
      ).expect(200);

      expect((listed.body.items as ChannelBody[]).map((one) => one.id)).toContain(channel.id);
    });

    it('recusa o canal de local sem locationId', async () => {
      const fixture = await setup();
      const response = await createChannel(fixture, {
        name: 'Sem local',
        locationType: 'space',
      }).expect(400);

      expect(response.body.code).toBe('INVALID_CHANNEL_LOCATION');
    });

    it('recusa participante que não é membro ativo', async () => {
      const fixture = await setup();
      const stranger = await createSession(ctx);
      const strangerId = (await withAuth(http().get('/api/v1/auth/me'), stranger).expect(200)).body
        .id as string;
      const response = await createChannel(fixture, {
        name: 'Interno',
        memberIds: [strangerId],
      }).expect(400);

      expect(response.body.code).toBe('INVALID_CHANNEL_MEMBERS');
    });

    it('esconde o canal privado de quem não participa', async () => {
      const fixture = await setup();
      const channel = (
        await createChannel(fixture, { name: 'Diretoria', private: true }).expect(201)
      ).body as ChannelBody;

      const denied = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/channels/${channel.id}`),
        fixture.member,
      ).expect(404);

      expect(denied.body.code).toBe('CHANNEL_NOT_FOUND');

      const listed = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/channels`),
        fixture.member,
      ).expect(200);

      expect((listed.body.items as ChannelBody[]).map((one) => one.id)).not.toContain(channel.id);

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/channels/${channel.id}/messages`),
        fixture.member,
      )
        .send({ bodyText: 'Oi' })
        .expect(404);
    });

    it('entra, adiciona participante e sai do canal', async () => {
      const fixture = await setup();
      const channel = (await createChannel(fixture, { name: 'Geral' }).expect(201))
        .body as ChannelBody;

      const joined = (
        await withAuth(
          http().post(`/api/v1/workspaces/${fixture.workspace.id}/channels/${channel.id}/join`),
          fixture.member,
        ).expect(200)
      ).body as ChannelBody;

      expect(joined.memberIds).toContain(fixture.memberId);

      const left = (
        await withAuth(
          http().post(`/api/v1/workspaces/${fixture.workspace.id}/channels/${channel.id}/leave`),
          fixture.member,
        ).expect(200)
      ).body as ChannelBody;

      expect(left.memberIds).not.toContain(fixture.memberId);

      const added = (
        await withAuth(
          http().post(`/api/v1/workspaces/${fixture.workspace.id}/channels/${channel.id}/members`),
          fixture.owner,
        )
          .send({ userIds: [fixture.memberId] })
          .expect(200)
      ).body as ChannelBody;

      expect(added.memberIds).toContain(fixture.memberId);

      const removed = (
        await withAuth(
          http().delete(
            `/api/v1/workspaces/${fixture.workspace.id}/channels/${channel.id}/members/${fixture.memberId}`,
          ),
          fixture.owner,
        ).expect(200)
      ).body as ChannelBody;

      expect(removed.memberIds).not.toContain(fixture.memberId);
    });

    it('somente quem criou ou um admin altera o canal', async () => {
      const fixture = await setup();
      const channel = (await createChannel(fixture, { name: 'Geral' }).expect(201))
        .body as ChannelBody;
      const denied = await withAuth(
        http().patch(`/api/v1/workspaces/${fixture.workspace.id}/channels/${channel.id}`),
        fixture.member,
      )
        .send({ name: 'Outro nome' })
        .expect(403);

      expect(denied.body.code).toBe('FORBIDDEN_CHANNEL');

      const archived = await withAuth(
        http().delete(`/api/v1/workspaces/${fixture.workspace.id}/channels/${channel.id}`),
        fixture.owner,
      ).expect(200);

      expect(archived.body).toEqual({ success: true });
    });

    it('a DM é única por par', async () => {
      const fixture = await setup();
      const first = (
        await withAuth(
          http().post(`/api/v1/workspaces/${fixture.workspace.id}/channels/dm`),
          fixture.owner,
        )
          .send({ userId: fixture.memberId })
          .expect(200)
      ).body as ChannelBody;

      const again = (
        await withAuth(
          http().post(`/api/v1/workspaces/${fixture.workspace.id}/channels/dm`),
          fixture.owner,
        )
          .send({ userId: fixture.memberId })
          .expect(200)
      ).body as ChannelBody;

      const reversed = (
        await withAuth(
          http().post(`/api/v1/workspaces/${fixture.workspace.id}/channels/dm`),
          fixture.member,
        )
          .send({ userId: fixture.ownerId })
          .expect(200)
      ).body as ChannelBody;

      expect(again.id).toBe(first.id);
      expect(reversed.id).toBe(first.id);
      expect(first.type).toBe('dm');

      const denied = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/channels/${first.id}`),
        fixture.outsider,
      ).expect(404);

      expect(denied.body.code).toBe('CHANNEL_NOT_FOUND');
    });

    it('recusa a DM consigo mesmo', async () => {
      const fixture = await setup();
      const response = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/channels/dm`),
        fixture.owner,
      )
        .send({ userId: fixture.ownerId })
        .expect(400);

      expect(response.body.code).toBe('INVALID_CHANNEL_MEMBERS');
    });
  });

  describe('mensagens', () => {
    it('envia, lista, edita, reage e exclui', async () => {
      const fixture = await setup();
      const channel = (await createChannel(fixture, { name: 'Geral' }).expect(201))
        .body as ChannelBody;
      const message = (
        await sendMessage(fixture, channel.id, { bodyText: 'Subi o build do PDV' }).expect(201)
      ).body as MessageBody;

      const listed = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/channels/${channel.id}/messages`),
        fixture.member,
      ).expect(200);

      expect((listed.body.items as MessageBody[]).map((one) => one.id)).toEqual([message.id]);

      const edited = (
        await withAuth(
          http().patch(`/api/v1/workspaces/${fixture.workspace.id}/messages/${message.id}`),
          fixture.owner,
        )
          .send({ bodyText: 'Subi o build do PDV (v2)' })
          .expect(200)
      ).body as MessageBody;

      expect(edited.bodyText).toBe('Subi o build do PDV (v2)');
      expect(edited.editedAt).not.toBeNull();

      const denied = await withAuth(
        http().patch(`/api/v1/workspaces/${fixture.workspace.id}/messages/${message.id}`),
        fixture.member,
      )
        .send({ bodyText: 'Editando a mensagem de outro' })
        .expect(403);

      expect(denied.body.code).toBe('FORBIDDEN_MESSAGE');

      const reacted = (
        await withAuth(
          http().post(
            `/api/v1/workspaces/${fixture.workspace.id}/messages/${message.id}/reactions`,
          ),
          fixture.owner,
        )
          .send({ emoji: '👍' })
          .expect(200)
      ).body as MessageBody;

      expect(reacted.reactions).toHaveLength(1);

      const unreacted = (
        await withAuth(
          http().post(
            `/api/v1/workspaces/${fixture.workspace.id}/messages/${message.id}/reactions`,
          ),
          fixture.owner,
        )
          .send({ emoji: '👍' })
          .expect(200)
      ).body as MessageBody;

      expect(unreacted.reactions).toHaveLength(0);

      await withAuth(
        http().delete(`/api/v1/workspaces/${fixture.workspace.id}/messages/${message.id}`),
        fixture.owner,
      ).expect(200);

      const after = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/channels/${channel.id}/messages`),
        fixture.owner,
      ).expect(200);

      expect(after.body.items).toHaveLength(0);
    });

    it('recusa a mensagem sem texto', async () => {
      const fixture = await setup();
      const channel = (await createChannel(fixture, { name: 'Geral' }).expect(201))
        .body as ChannelBody;

      await sendMessage(fixture, channel.id, {}).expect(400);
    });

    it('a resposta incrementa replyCount da raiz', async () => {
      const fixture = await setup();
      const channel = (await createChannel(fixture, { name: 'Geral' }).expect(201))
        .body as ChannelBody;
      const root = (
        await sendMessage(fixture, channel.id, { bodyText: 'Deploy hoje?' }).expect(201)
      ).body as MessageBody;

      const reply = (
        await sendMessage(fixture, channel.id, {
          bodyText: 'Sim, às 18h',
          parentMessageId: root.id,
        }).expect(201)
      ).body as MessageBody;

      expect(reply.parentMessageId).toBe(root.id);

      const replies = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/messages/${root.id}/replies`),
        fixture.owner,
      ).expect(200);

      expect((replies.body.items as MessageBody[]).map((one) => one.id)).toEqual([reply.id]);

      const listed = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/channels/${channel.id}/messages`),
        fixture.owner,
      ).expect(200);
      const items = listed.body.items as MessageBody[];

      expect(items).toHaveLength(1);
      expect(items[0].replyCount).toBe(1);
      expect(items[0].lastReplyAt).not.toBeNull();
    });

    it('recusa a thread de outro canal', async () => {
      const fixture = await setup();
      const first = (await createChannel(fixture, { name: 'Geral' }).expect(201))
        .body as ChannelBody;
      const second = (await createChannel(fixture, { name: 'Dev' }).expect(201))
        .body as ChannelBody;
      const root = (await sendMessage(fixture, first.id, { bodyText: 'Raiz' }).expect(201))
        .body as MessageBody;
      const response = await sendMessage(fixture, second.id, {
        bodyText: 'Resposta',
        parentMessageId: root.id,
      }).expect(400);

      expect(response.body.code).toBe('INVALID_MESSAGE_PARENT');
    });

    it('a mensagem vira tarefa com link para a conversa', async () => {
      const fixture = await setup();
      const channel = (await createChannel(fixture, { name: 'Geral' }).expect(201))
        .body as ChannelBody;
      const message = (
        await sendMessage(fixture, channel.id, {
          bodyText: 'Corrigir fechamento de caixa\nveio do cliente',
        }).expect(201)
      ).body as MessageBody;

      const response = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/messages/${message.id}/to-task`),
        fixture.owner,
      )
        .send({ listId: fixture.list.id })
        .expect(201);

      expect(response.body.task.name).toBe('Corrigir fechamento de caixa');
      expect(response.body.task.listId).toBe(fixture.list.id);
      expect(response.body.messageUrl).toContain(message.id);
      expect(response.body.task.descriptionText).toContain(response.body.messageUrl);
    });

    it('recusa virar tarefa em List invisível', async () => {
      const fixture = await setup();
      const privateSpace = (
        await withAuth(
          http().post(`/api/v1/workspaces/${fixture.workspace.id}/spaces`),
          fixture.owner,
        )
          .send({ name: 'Diretoria', private: true })
          .expect(201)
      ).body as IdBody;
      const privateList = (
        await withAuth(
          http().post(`/api/v1/workspaces/${fixture.workspace.id}/lists`),
          fixture.owner,
        )
          .send({ spaceId: privateSpace.id, name: 'Confidencial' })
          .expect(201)
      ).body as IdBody;
      const channel = (await createChannel(fixture, { name: 'Geral' }).expect(201))
        .body as ChannelBody;
      const message = (
        await sendMessage(fixture, channel.id, { bodyText: 'Vira tarefa?' }, fixture.member).expect(
          201,
        )
      ).body as MessageBody;

      const response = await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/messages/${message.id}/to-task`),
        fixture.member,
      )
        .send({ listId: privateList.id })
        .expect(404);

      expect(response.body.code).toBe('LIST_NOT_FOUND');
    });
  });

  describe('não lidas e busca', () => {
    it('zera as não lidas ao marcar leitura', async () => {
      const fixture = await setup();
      const channel = (
        await createChannel(fixture, { name: 'Geral', memberIds: [fixture.memberId] }).expect(201)
      ).body as ChannelBody;

      await sendMessage(fixture, channel.id, { bodyText: 'Primeira' }).expect(201);
      await sendMessage(fixture, channel.id, { bodyText: 'Segunda' }).expect(201);

      const before = (
        await withAuth(
          http().get(`/api/v1/workspaces/${fixture.workspace.id}/me/chat-activity`),
          fixture.member,
        ).expect(200)
      ).body as ChatActivityBody;
      const line = before.items.find((one) => one.channelId === channel.id);

      expect(before.unread).toBe(2);
      expect(line?.unread).toBe(2);
      expect(line?.lastMessageAt).not.toBeNull();

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/channels/${channel.id}/read`),
        fixture.member,
      ).expect(200);

      const after = (
        await withAuth(
          http().get(`/api/v1/workspaces/${fixture.workspace.id}/me/chat-activity`),
          fixture.member,
        ).expect(200)
      ).body as ChatActivityBody;

      expect(after.unread).toBe(0);
      expect(after.items.find((one) => one.channelId === channel.id)?.unread).toBe(0);

      const author = (
        await withAuth(
          http().get(`/api/v1/workspaces/${fixture.workspace.id}/me/chat-activity`),
          fixture.owner,
        ).expect(200)
      ).body as ChatActivityBody;

      expect(author.unread).toBe(0);
    });

    it('a busca global encontra a mensagem e esconde o canal privado', async () => {
      const fixture = await setup();
      const open = (await createChannel(fixture, { name: 'Geral' }).expect(201))
        .body as ChannelBody;
      const secret = (
        await createChannel(fixture, { name: 'Diretoria', private: true }).expect(201)
      ).body as ChannelBody;

      await sendMessage(fixture, open.id, { bodyText: 'Fechamento de caixa do PDV' }).expect(201);
      await sendMessage(fixture, secret.id, { bodyText: 'Fechamento de caixa sigiloso' }).expect(
        201,
      );

      const found = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/search?q=fechamento&types=message`),
        fixture.member,
      ).expect(200);
      const hits = found.body.results.message as { channelId: string; bodyText: string }[];

      expect(hits).toHaveLength(1);
      expect(hits[0].channelId).toBe(open.id);

      const forOwner = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/search?q=fechamento&types=message`),
        fixture.owner,
      ).expect(200);

      expect(forOwner.body.results.message).toHaveLength(2);
    });
  });

  describe('tempo real e notificações', () => {
    it('entrega message.new na sala do canal', async () => {
      const fixture = await setup();
      const channel = (await createChannel(fixture, { name: 'Geral' }).expect(201))
        .body as ChannelBody;
      const client = connect(fixture.member.accessToken);

      await connected(client);

      await expect(
        client.emitWithAck('join', {
          room: 'channel',
          id: channel.id,
          wsId: fixture.workspace.id,
        }),
      ).resolves.toEqual({ joined: `channel:${channel.id}` });

      const received = nextEvent<Record<string, unknown>>(client, 'message.new');

      const message = (
        await sendMessage(fixture, channel.id, { bodyText: 'Chegou pelo socket' }).expect(201)
      ).body as MessageBody;
      const payload = await received;

      expect(payload.messageId).toBe(message.id);
      expect(payload.channelId).toBe(channel.id);
      expect(payload.authorId).toBe(fixture.ownerId);
    });

    it('nega a sala de um canal privado de outra pessoa', async () => {
      const fixture = await setup();
      const channel = (
        await createChannel(fixture, { name: 'Diretoria', private: true }).expect(201)
      ).body as ChannelBody;
      const client = connect(fixture.member.accessToken);

      await connected(client);

      await expect(
        client.emitWithAck('join', {
          room: 'channel',
          id: channel.id,
          wsId: fixture.workspace.id,
        }),
      ).resolves.toEqual({ code: 'FORBIDDEN_ROOM' });
    });

    it('relaia o typing para os outros clientes da sala', async () => {
      const fixture = await setup();
      const channel = (await createChannel(fixture, { name: 'Geral' }).expect(201))
        .body as ChannelBody;
      const watcher = connect(fixture.member.accessToken);
      const author = connect(fixture.owner.accessToken);

      await Promise.all([connected(watcher), connected(author)]);

      const room = { room: 'channel', id: channel.id, wsId: fixture.workspace.id };

      await watcher.emitWithAck('join', room);
      await author.emitWithAck('join', room);

      const received = nextEvent<{ channelId: string; userId: string; typing: boolean }>(
        watcher,
        'typing',
      );

      await author.emitWithAck('typing', room);

      const payload = await received;

      expect(payload.channelId).toBe(channel.id);
      expect(payload.userId).toBe(fixture.ownerId);
      expect(payload.typing).toBe(true);
    });

    it('a menção e a DM geram notificação no inbox', async () => {
      const fixture = await setup();
      const channel = (
        await createChannel(fixture, { name: 'Geral', memberIds: [fixture.memberId] }).expect(201)
      ).body as ChannelBody;

      await sendMessage(fixture, channel.id, {
        bodyText: 'bom dia',
        body: {
          type: 'doc',
          content: [{ type: 'mention', attrs: { id: fixture.memberId } }],
        },
      }).expect(201);

      const dm = (
        await withAuth(
          http().post(`/api/v1/workspaces/${fixture.workspace.id}/channels/dm`),
          fixture.owner,
        )
          .send({ userId: fixture.memberId })
          .expect(200)
      ).body as ChannelBody;

      await sendMessage(fixture, dm.id, { bodyText: 'tudo certo?' }).expect(201);

      const inbox = await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/inbox?tab=primary`),
        fixture.member,
      ).expect(200);
      const types = (inbox.body.items as { type: string; entityType: string }[]).map(
        (one) => one.type,
      );

      expect(types).toContain('chatMention');
      expect(types).toContain('chatMessage');
    });
  });
});
