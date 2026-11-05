import request from 'supertest';
import { Session, createSession } from './utils/auth-client';
import { TestApp, createTestApp } from './utils/e2e-app';

interface WorkspaceBody {
  id: string;
  taskPrefix: string;
}

interface SpaceBody {
  id: string;
  statusSetId: string;
}

interface ListBody {
  id: string;
}

interface StatusBody {
  id: string;
  name: string;
  color: string;
  group: 'notStarted' | 'active' | 'done' | 'closed';
}

interface TaskBody {
  id: string;
  customId: string;
  name: string;
  listId: string;
  listIds: string[];
  parentTaskId: string | null;
  statusId: string;
  statusGroup: string;
  priority: string | null;
  assigneeIds: string[];
  tagIds: string[];
  dueAt: string | null;
  position: string;
  closedAt: string | null;
  deletedAt: string | null;
}

interface TagBody {
  id: string;
  name: string;
  color: string;
}

interface QueryPage {
  items: TaskBody[];
  nextCursor: string | null;
}

interface GroupedBody {
  groups: { key: string; label: string; items: TaskBody[]; nextCursor: string | null }[];
}

interface MyTasksBody {
  timezone: string;
  sections: Record<'overdue' | 'today' | 'next7' | 'later' | 'noDate', TaskBody[]>;
}

interface MemberFixture {
  session: Session;
  userId: string;
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** First instant of the current day for a fixed UTC offset, computed independently. */
function dayStartForOffset(now: number, offsetHours: number): number {
  const shift = offsetHours * HOUR_MS;

  return Math.floor((now + shift) / DAY_MS) * DAY_MS - shift;
}

describe('Tarefas', () => {
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

  async function createWorkspace(session: Session): Promise<WorkspaceBody> {
    const response = await withAuth(http().post('/api/v1/workspaces'), session)
      .send({ name: 'Azuos Dev' })
      .expect(201);

    return response.body as WorkspaceBody;
  }

  async function addMember(
    workspace: WorkspaceBody,
    owner: Session,
    role: 'admin' | 'member' | 'limited' | 'guest',
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

  async function createSpace(
    workspace: WorkspaceBody,
    session: Session,
    body: Record<string, unknown> = {},
  ): Promise<SpaceBody> {
    const response = await withAuth(
      http().post(`/api/v1/workspaces/${workspace.id}/spaces`),
      session,
    )
      .send({ name: 'Clientes', ...body })
      .expect(201);

    return response.body as SpaceBody;
  }

  async function createList(
    workspace: WorkspaceBody,
    session: Session,
    space: SpaceBody,
    name = 'uSolutionsPDV — Sprint 3',
  ): Promise<ListBody> {
    const response = await withAuth(
      http().post(`/api/v1/workspaces/${workspace.id}/lists`),
      session,
    )
      .send({ spaceId: space.id, name })
      .expect(201);

    return response.body as ListBody;
  }

  async function statusesOf(
    workspace: WorkspaceBody,
    session: Session,
    list: ListBody,
  ): Promise<StatusBody[]> {
    const response = await withAuth(
      http().get(`/api/v1/workspaces/${workspace.id}/lists/${list.id}/statuses`),
      session,
    ).expect(200);

    return response.body.statuses as StatusBody[];
  }

  function createTask(
    workspace: WorkspaceBody,
    session: Session,
    list: ListBody,
    body: Record<string, unknown> = {},
  ): request.Test {
    return withAuth(
      http().post(`/api/v1/workspaces/${workspace.id}/lists/${list.id}/tasks`),
      session,
    ).send({ name: 'Corrigir fechamento de caixa', ...body });
  }

  async function createdTask(
    workspace: WorkspaceBody,
    session: Session,
    list: ListBody,
    body: Record<string, unknown> = {},
  ): Promise<TaskBody> {
    const response = await createTask(workspace, session, list, body).expect(201);

    return response.body as TaskBody;
  }

  function queryTasks(
    workspace: WorkspaceBody,
    session: Session,
    query: Record<string, unknown> = {},
  ): request.Test {
    return withAuth(http().get(`/api/v1/workspaces/${workspace.id}/tasks/query`), session).query(
      query,
    );
  }

  interface Fixture {
    owner: Session;
    workspace: WorkspaceBody;
    space: SpaceBody;
    list: ListBody;
    statuses: StatusBody[];
  }

  async function setup(): Promise<Fixture> {
    const owner = await createSession(ctx);
    const workspace = await createWorkspace(owner);
    const space = await createSpace(workspace, owner);
    const list = await createList(workspace, owner, space);

    return { owner, workspace, space, list, statuses: await statusesOf(workspace, owner, list) };
  }

  describe('criação e customId', () => {
    it('cria a tarefa com o primeiro status da List e customId do workspace', async () => {
      const { owner, workspace, list, statuses } = await setup();

      const task = await createdTask(workspace, owner, list);

      expect(task.customId).toBe(`${workspace.taskPrefix}-1`);
      expect(task.statusId).toBe(statuses[0].id);
      expect(task.statusGroup).toBe(statuses[0].group);
      expect(task.listIds).toEqual([list.id]);
      expect(task.closedAt).toBeNull();
    });

    it('gera customIds únicos e sequenciais em 10 criações paralelas', async () => {
      const { owner, workspace, list } = await setup();

      const responses = await Promise.all(
        Array.from({ length: 10 }, (_, index) =>
          createTask(workspace, owner, list, { name: `Tarefa ${index}` }).expect(201),
        ),
      );

      const numbers = responses
        .map((response) => (response.body as TaskBody).customId)
        .map((customId) => {
          expect(customId.startsWith(`${workspace.taskPrefix}-`)).toBe(true);

          return Number(customId.split('-')[1]);
        })
        .sort((a, b) => a - b);

      expect(new Set(numbers).size).toBe(10);
      expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it('preenche closedAt quando o status é do grupo done', async () => {
      const { owner, workspace, list, statuses } = await setup();
      const done = statuses.find((status) => status.group === 'done');

      const task = await createdTask(workspace, owner, list, { statusId: done?.id });

      expect(task.statusGroup).toBe('done');
      expect(task.closedAt).not.toBeNull();
    });

    it('recusa nome vazio, campo desconhecido e status de outra List', async () => {
      const { owner, workspace, list } = await setup();

      await createTask(workspace, owner, list, { name: '' }).expect(400);
      await createTask(workspace, owner, list, { unknown: true }).expect(400);

      const response = await createTask(workspace, owner, list, {
        statusId: '507f1f77bcf86cd799439011',
      }).expect(400);

      expect(response.body.code).toBe('INVALID_STATUS');
    });

    it('recusa responsável que não é membro ativo', async () => {
      const { owner, workspace, list } = await setup();
      const outsider = await createSession(ctx);
      const me = await withAuth(http().get('/api/v1/auth/me'), outsider).expect(200);

      const response = await createTask(workspace, owner, list, {
        assigneeIds: [me.body.id],
      }).expect(400);

      expect(response.body.code).toBe('INVALID_ASSIGNEES');
    });
  });

  describe('leitura, edição e lixeira', () => {
    it('busca por id e por customId', async () => {
      const { owner, workspace, list } = await setup();
      const task = await createdTask(workspace, owner, list);

      const byId = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/tasks/${task.id}`),
        owner,
      ).expect(200);
      const byCustomId = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/tasks/${task.customId}`),
        owner,
      ).expect(200);

      expect(byId.body.id).toBe(task.id);
      expect(byCustomId.body.id).toBe(task.id);
    });

    it('atualiza campos, limpa closedAt ao reabrir e valida a entrada', async () => {
      const { owner, workspace, list, statuses } = await setup();
      const done = statuses.find((status) => status.group === 'done');
      const active = statuses.find((status) => status.group === 'active');
      const task = await createdTask(workspace, owner, list, { statusId: done?.id });

      const reopened = await withAuth(
        http().patch(`/api/v1/workspaces/${workspace.id}/tasks/${task.id}`),
        owner,
      )
        .send({ statusId: active?.id, priority: 'urgent', name: 'Novo nome' })
        .expect(200);

      expect(reopened.body.statusGroup).toBe('active');
      expect(reopened.body.closedAt).toBeNull();
      expect(reopened.body.priority).toBe('urgent');
      expect(reopened.body.name).toBe('Novo nome');

      await withAuth(http().patch(`/api/v1/workspaces/${workspace.id}/tasks/${task.id}`), owner)
        .send({ priority: 'altíssima' })
        .expect(400);
    });

    it('exclui em cascata e restaura a tarefa com as subtarefas', async () => {
      const { owner, workspace, list } = await setup();
      const parent = await createdTask(workspace, owner, list);
      const child = await createdTask(workspace, owner, list, {
        name: 'Subtarefa',
        parentTaskId: parent.id,
      });

      await withAuth(
        http().delete(`/api/v1/workspaces/${workspace.id}/tasks/${parent.id}`),
        owner,
      ).expect(200);

      await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/tasks/${child.id}`),
        owner,
      ).expect(404);

      await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/tasks/${parent.id}/restore`),
        owner,
      ).expect(200);

      const restored = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/tasks/${child.id}`),
        owner,
      ).expect(200);

      expect(restored.body.deletedAt).toBeNull();
    });

    it('arquiva e desarquiva a tarefa com as subtarefas diretas', async () => {
      const { owner, workspace, list } = await setup();
      const parent = await createdTask(workspace, owner, list);
      const child = await createdTask(workspace, owner, list, {
        name: 'Subtarefa',
        parentTaskId: parent.id,
      });

      const archived = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/tasks/${parent.id}/archive`),
        owner,
      ).expect(200);

      expect(archived.body.archivedAt).not.toBeNull();

      const archivedChild = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/tasks/${child.id}`),
        owner,
      ).expect(200);

      expect(archivedChild.body.archivedAt).not.toBeNull();

      const query = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/tasks/query`).query({ groupBy: 'none' }),
        owner,
      ).expect(200);

      expect((query.body.items as { id: string }[]).map((item) => item.id)).not.toContain(
        parent.id,
      );

      await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/tasks/${parent.id}/unarchive`),
        owner,
      ).expect(200);

      const back = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/tasks/${child.id}`),
        owner,
      ).expect(200);

      expect(back.body.archivedAt).toBeNull();
    });

    it('guest com permissão de view não arquiva a tarefa', async () => {
      const { owner, workspace, list } = await setup();
      const task = await createdTask(workspace, owner, list);
      const guest = await addMember(workspace, owner, 'guest');

      await withAuth(http().post(`/api/v1/workspaces/${workspace.id}/permissions`), owner)
        .send({
          resourceType: 'list',
          resourceId: list.id,
          principalType: 'user',
          principalId: guest.userId,
          level: 'view',
        })
        .expect(201);

      const forbidden = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/tasks/${task.id}/archive`),
        guest.session,
      ).expect(403);

      expect(forbidden.body.code).toBe('FORBIDDEN_RESOURCE');
    });
  });

  describe('subtarefas', () => {
    it('lista as subtarefas diretas e limita a profundidade em 5', async () => {
      const { owner, workspace, list } = await setup();
      let parentTaskId: string | undefined;
      const chain: TaskBody[] = [];

      for (let depth = 1; depth <= 5; depth += 1) {
        const task = await createdTask(workspace, owner, list, {
          name: `Nível ${depth}`,
          parentTaskId,
        });

        chain.push(task);
        parentTaskId = task.id;
      }

      const subtasks = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/tasks/${chain[0].id}/subtasks`),
        owner,
      ).expect(200);

      expect(subtasks.body.items.map((item: TaskBody) => item.id)).toEqual([chain[1].id]);

      const tooDeep = await createTask(workspace, owner, list, {
        name: 'Nível 6',
        parentTaskId,
      }).expect(400);

      expect(tooDeep.body.code).toBe('TASK_DEPTH_EXCEEDED');
    });

    it('recusa pai de outra List', async () => {
      const { owner, workspace, space, list } = await setup();
      const other = await createList(workspace, owner, space, 'Outra List');
      const parent = await createdTask(workspace, owner, list);

      const response = await createTask(workspace, owner, other, {
        name: 'Subtarefa',
        parentTaskId: parent.id,
      }).expect(400);

      expect(response.body.code).toBe('INVALID_TASK_PARENT');
    });
  });

  describe('mover e multi-list', () => {
    it('move a tarefa de List e posiciona entre irmãs', async () => {
      const { owner, workspace, space, list } = await setup();
      const target = await createList(workspace, owner, space, 'Sprint 4');
      const first = await createdTask(workspace, owner, target, { name: 'Primeira' });
      const second = await createdTask(workspace, owner, target, { name: 'Segunda' });
      const task = await createdTask(workspace, owner, list);

      const moved = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/tasks/${task.id}/move`),
        owner,
      )
        .send({ listId: target.id, previousId: first.id, nextId: second.id })
        .expect(200);

      expect(moved.body.listId).toBe(target.id);
      expect(moved.body.listIds).toEqual([target.id]);
      expect(moved.body.position > first.position).toBe(true);
      expect(moved.body.position < second.position).toBe(true);
    });

    it('adiciona e remove Lists secundárias, protegendo a principal', async () => {
      const { owner, workspace, space, list } = await setup();
      const secondary = await createList(workspace, owner, space, 'Sprint 4');
      const task = await createdTask(workspace, owner, list);

      const added = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/tasks/${task.id}/lists`),
        owner,
      )
        .send({ listId: secondary.id })
        .expect(200);

      expect(added.body.listIds).toEqual([list.id, secondary.id]);

      const blocked = await withAuth(
        http().delete(`/api/v1/workspaces/${workspace.id}/tasks/${task.id}/lists/${list.id}`),
        owner,
      ).expect(400);

      expect(blocked.body.code).toBe('PRIMARY_LIST_IMMUTABLE');

      const removed = await withAuth(
        http().delete(`/api/v1/workspaces/${workspace.id}/tasks/${task.id}/lists/${secondary.id}`),
        owner,
      ).expect(200);

      expect(removed.body.listIds).toEqual([list.id]);
    });
  });

  describe('tags', () => {
    it('faz o CRUD das tags e valida tags de outro workspace', async () => {
      const { owner, workspace, space, list } = await setup();

      const created = await withAuth(http().post(`/api/v1/workspaces/${workspace.id}/tags`), owner)
        .send({ spaceId: space.id, name: 'backend', color: '#2563EB' })
        .expect(201);

      const tag = created.body as TagBody;

      const listed = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/tags`),
        owner,
      ).expect(200);

      expect(listed.body.items.map((item: TagBody) => item.id)).toEqual([tag.id]);

      const updated = await withAuth(
        http().patch(`/api/v1/workspaces/${workspace.id}/tags/${tag.id}`),
        owner,
      )
        .send({ name: 'api' })
        .expect(200);

      expect(updated.body.name).toBe('api');

      const task = await createdTask(workspace, owner, list, { tagIds: [tag.id] });

      expect(task.tagIds).toEqual([tag.id]);

      const invalid = await createTask(workspace, owner, list, {
        name: 'Outra',
        tagIds: ['507f1f77bcf86cd799439011'],
      }).expect(400);

      expect(invalid.body.code).toBe('INVALID_TAGS');

      await withAuth(
        http().delete(`/api/v1/workspaces/${workspace.id}/tags/${tag.id}`),
        owner,
      ).expect(200);

      await withAuth(http().patch(`/api/v1/workspaces/${workspace.id}/tags/${tag.id}`), owner)
        .send({ name: 'x' })
        .expect(404);
    });

    it('guest sem acesso não cria tag', async () => {
      const { owner, workspace, space } = await setup();
      const guest = await addMember(workspace, owner, 'guest');

      await withAuth(http().post(`/api/v1/workspaces/${workspace.id}/tags`), guest.session)
        .send({ spaceId: space.id, name: 'backend' })
        .expect(403);
    });
  });

  describe('consulta das views', () => {
    it('filtra por status, grupo, responsável, prioridade, tag, datas e texto', async () => {
      const { owner, workspace, space, list, statuses } = await setup();
      const member = await addMember(workspace, owner, 'member');
      const active = statuses.find((status) => status.group === 'active');
      const done = statuses.find((status) => status.group === 'done');
      const tag = await withAuth(http().post(`/api/v1/workspaces/${workspace.id}/tags`), owner)
        .send({ spaceId: space.id, name: 'backend' })
        .expect(201);

      const urgent = await createdTask(workspace, owner, list, {
        name: 'Sangria parcial do caixa',
        statusId: active?.id,
        priority: 'urgent',
        assigneeIds: [member.userId],
        tagIds: [tag.body.id],
        dueAt: new Date(Date.now() + DAY_MS).toISOString(),
      });
      const low = await createdTask(workspace, owner, list, {
        name: 'Revisão de performance',
        priority: 'low',
      });
      const closed = await createdTask(workspace, owner, list, {
        name: 'Tarefa concluída',
        statusId: done?.id,
      });

      const open = await queryTasks(workspace, owner).expect(200);

      expect(ids(open.body)).toEqual(expect.arrayContaining([urgent.id, low.id]));
      expect(ids(open.body)).not.toContain(closed.id);

      const withClosed = await queryTasks(workspace, owner, { includeClosed: true }).expect(200);

      expect(ids(withClosed.body)).toContain(closed.id);

      const byStatus = await queryTasks(workspace, owner, { statusIds: active?.id }).expect(200);

      expect(ids(byStatus.body)).toEqual([urgent.id]);

      const byGroup = await queryTasks(workspace, owner, { statusGroups: 'done' }).expect(200);

      expect(ids(byGroup.body)).toEqual([closed.id]);

      const byAssignee = await queryTasks(workspace, owner, {
        assigneeIds: member.userId,
      }).expect(200);

      expect(ids(byAssignee.body)).toEqual([urgent.id]);

      const mine = await queryTasks(workspace, member.session, { me: true }).expect(200);

      expect(ids(mine.body)).toEqual([urgent.id]);

      const byPriority = await queryTasks(workspace, owner, { priority: 'urgent,high' }).expect(
        200,
      );

      expect(ids(byPriority.body)).toEqual([urgent.id]);

      const byTag = await queryTasks(workspace, owner, { tagIds: tag.body.id }).expect(200);

      expect(ids(byTag.body)).toEqual([urgent.id]);

      const byDue = await queryTasks(workspace, owner, {
        dueFrom: new Date(Date.now() - HOUR_MS).toISOString(),
        dueTo: new Date(Date.now() + 2 * DAY_MS).toISOString(),
      }).expect(200);

      expect(ids(byDue.body)).toEqual([urgent.id]);

      const byName = await queryTasks(workspace, owner, { q: 'sangria' }).expect(200);

      expect(ids(byName.body)).toEqual([urgent.id]);

      const byCustomId = await queryTasks(workspace, owner, { q: low.customId }).expect(200);

      expect(ids(byCustomId.body)).toEqual([low.id]);

      const escaped = await queryTasks(workspace, owner, { q: '.*' }).expect(200);

      expect(escaped.body.items).toHaveLength(0);
    });

    it('filtra por location e inclui subtarefas quando pedido', async () => {
      const { owner, workspace, space, list } = await setup();
      const other = await createList(workspace, owner, space, 'Sprint 4');
      const parent = await createdTask(workspace, owner, list);
      const child = await createdTask(workspace, owner, list, {
        name: 'Subtarefa',
        parentTaskId: parent.id,
      });
      const elsewhere = await createdTask(workspace, owner, other, { name: 'Outra List' });

      const inList = await queryTasks(workspace, owner, {
        location: 'list',
        locationId: list.id,
      }).expect(200);

      expect(ids(inList.body)).toEqual([parent.id]);

      const withSubtasks = await queryTasks(workspace, owner, {
        location: 'list',
        locationId: list.id,
        includeSubtasks: true,
      }).expect(200);

      expect(ids(withSubtasks.body)).toEqual(expect.arrayContaining([parent.id, child.id]));

      const inSpace = await queryTasks(workspace, owner, {
        location: 'space',
        locationId: space.id,
      }).expect(200);

      expect(ids(inSpace.body)).toEqual(expect.arrayContaining([parent.id, elsewhere.id]));
    });

    it('conta as subtarefas de cada tarefa da consulta', async () => {
      const { owner, workspace, list, statuses } = await setup();
      const done = statuses.find((status) => status.group === 'done');
      const parent = await createdTask(workspace, owner, list);

      await createdTask(workspace, owner, list, { name: 'Subtarefa 1', parentTaskId: parent.id });
      await createdTask(workspace, owner, list, {
        name: 'Subtarefa 2',
        parentTaskId: parent.id,
        statusId: done?.id,
      });

      const alone = await createdTask(workspace, owner, list, { name: 'Sem subtarefa' });
      const page = await queryTasks(workspace, owner, {
        location: 'list',
        locationId: list.id,
      }).expect(200);
      const items = (page.body as QueryPage).items;
      const withChildren = items.find((item) => item.id === parent.id);

      expect(withChildren).toMatchObject({ subtaskCount: 2, subtaskDoneCount: 1 });
      expect(items.find((item) => item.id === alone.id)).toMatchObject({
        subtaskCount: 0,
        subtaskDoneCount: 0,
      });
    });

    it('agrupa por status, prioridade, responsável e data', async () => {
      const { owner, workspace, list, statuses } = await setup();
      const member = await addMember(workspace, owner, 'member');
      const active = statuses.find((status) => status.group === 'active');

      const urgent = await createdTask(workspace, owner, list, {
        name: 'Urgente',
        statusId: active?.id,
        priority: 'urgent',
        assigneeIds: [member.userId],
        dueAt: new Date(Date.now() - DAY_MS).toISOString(),
      });
      const normal = await createdTask(workspace, owner, list, { name: 'Normal' });

      const byStatus = await queryTasks(workspace, owner, { groupBy: 'status' }).expect(200);
      const statusGroups = (byStatus.body as GroupedBody).groups;

      expect(statusGroups.map((group) => group.key)).toEqual([statuses[0].id, active?.id]);
      expect(statusGroups[0].label).toBe(statuses[0].name);
      expect(statusGroups[1].items.map((item) => item.id)).toEqual([urgent.id]);

      const byPriority = await queryTasks(workspace, owner, { groupBy: 'priority' }).expect(200);

      expect((byPriority.body as GroupedBody).groups.map((group) => group.key)).toEqual([
        'urgent',
        'none',
      ]);

      const byAssignee = await queryTasks(workspace, owner, { groupBy: 'assignee' }).expect(200);
      const assigneeGroups = (byAssignee.body as GroupedBody).groups;

      expect(assigneeGroups.map((group) => group.key)).toEqual([member.userId, 'unassigned']);
      expect(assigneeGroups[1].items.map((item) => item.id)).toEqual([normal.id]);

      const byDueDate = await queryTasks(workspace, owner, { groupBy: 'dueDate' }).expect(200);
      const dueGroups = (byDueDate.body as GroupedBody).groups;

      expect(dueGroups.map((group) => group.key)).toEqual(['overdue', 'noDate']);
      expect(dueGroups[0].label).toBe('Atrasadas');
    });

    it('ordena e pagina por cursor', async () => {
      const { owner, workspace, list } = await setup();
      const names = ['Charlie', 'Alfa', 'Bravo'];

      for (const name of names) {
        await createdTask(workspace, owner, list, { name });
      }

      const first = await queryTasks(workspace, owner, { sortBy: 'name', limit: 2 }).expect(200);
      const page = first.body as QueryPage;

      expect(page.items.map((item) => item.name)).toEqual(['Alfa', 'Bravo']);
      expect(page.nextCursor).not.toBeNull();

      const second = await queryTasks(workspace, owner, {
        sortBy: 'name',
        limit: 2,
        cursor: page.nextCursor,
      }).expect(200);

      expect((second.body as QueryPage).items.map((item) => item.name)).toEqual(['Charlie']);
      expect((second.body as QueryPage).nextCursor).toBeNull();
    });

    it('recusa limite acima de 100 e cursor inválido', async () => {
      const { owner, workspace } = await setup();

      await queryTasks(workspace, owner, { limit: 101 }).expect(400);

      const response = await queryTasks(workspace, owner, { cursor: 'nope' }).expect(400);

      expect(response.body.code).toBe('INVALID_CURSOR');
    });
  });

  describe('my-tasks', () => {
    it('separa as seções pelo fuso do usuário', async () => {
      const { owner, workspace, list } = await setup();
      const me = await withAuth(http().get('/api/v1/auth/me'), owner).expect(200);

      await withAuth(http().patch('/api/v1/users/me'), owner)
        .send({ timezone: 'Etc/GMT-14' })
        .expect(200);

      const boundary = dayStartForOffset(Date.now(), 14);
      const atMidnight = await createdTask(workspace, owner, list, {
        name: 'No limite',
        assigneeIds: [me.body.id],
        dueAt: new Date(boundary).toISOString(),
      });
      const beforeMidnight = await createdTask(workspace, owner, list, {
        name: 'Um instante antes',
        assigneeIds: [me.body.id],
        dueAt: new Date(boundary - 1).toISOString(),
      });
      const noDate = await createdTask(workspace, owner, list, {
        name: 'Sem data',
        assigneeIds: [me.body.id],
      });
      await createdTask(workspace, owner, list, { name: 'De ninguém' });

      const east = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/my-tasks`),
        owner,
      ).expect(200);
      const eastBody = east.body as MyTasksBody;

      expect(eastBody.timezone).toBe('Etc/GMT-14');
      expect(sectionOf(eastBody, atMidnight.id)).toBe('today');
      expect(sectionOf(eastBody, beforeMidnight.id)).toBe('overdue');
      expect(sectionOf(eastBody, noDate.id)).toBe('noDate');
      expect(Object.values(eastBody.sections).flat()).toHaveLength(3);

      await withAuth(http().patch('/api/v1/users/me'), owner)
        .send({ timezone: 'Etc/GMT+11' })
        .expect(200);

      const west = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/my-tasks`),
        owner,
      ).expect(200);
      const westBody = west.body as MyTasksBody;

      expect(westBody.timezone).toBe('Etc/GMT+11');
      expect(sectionOf(westBody, atMidnight.id)).toBe(sectionOf(westBody, beforeMidnight.id));
    });
  });

  describe('bulk', () => {
    it('aplica status, responsáveis, prioridade, datas e mover em lote', async () => {
      const { owner, workspace, space, list, statuses } = await setup();
      const member = await addMember(workspace, owner, 'member');
      const target = await createList(workspace, owner, space, 'Sprint 4');
      const active = statuses.find((status) => status.group === 'active');
      const first = await createdTask(workspace, owner, list, { name: 'Primeira' });
      const second = await createdTask(workspace, owner, list, {
        name: 'Segunda',
        assigneeIds: [member.userId],
      });
      const dueAt = new Date(Date.now() + DAY_MS).toISOString();

      const response = await withAuth(
        http().patch(`/api/v1/workspaces/${workspace.id}/tasks/bulk`),
        owner,
      )
        .send({
          ids: [first.id, second.id],
          changes: {
            statusId: active?.id,
            priority: 'high',
            addAssigneeIds: [member.userId],
            dueAt,
            listId: target.id,
          },
        })
        .expect(200);

      expect(response.body).toEqual({ updated: 2, skipped: [] });

      const moved = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/tasks/${first.id}`),
        owner,
      ).expect(200);

      expect(moved.body.listId).toBe(target.id);
      expect(moved.body.statusId).toBe(active?.id);
      expect(moved.body.priority).toBe('high');
      expect(moved.body.assigneeIds).toEqual([member.userId]);
      expect(moved.body.dueAt).toBe(dueAt);
    });

    it('remove responsáveis e envia para a lixeira em lote', async () => {
      const { owner, workspace, list } = await setup();
      const member = await addMember(workspace, owner, 'member');
      const task = await createdTask(workspace, owner, list, {
        assigneeIds: [member.userId],
      });

      await withAuth(http().patch(`/api/v1/workspaces/${workspace.id}/tasks/bulk`), owner)
        .send({ ids: [task.id], changes: { removeAssigneeIds: [member.userId] } })
        .expect(200);

      const cleared = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/tasks/${task.id}`),
        owner,
      ).expect(200);

      expect(cleared.body.assigneeIds).toEqual([]);

      await withAuth(http().patch(`/api/v1/workspaces/${workspace.id}/tasks/bulk`), owner)
        .send({ ids: [task.id], changes: { deleted: true } })
        .expect(200);

      await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/tasks/${task.id}`),
        owner,
      ).expect(404);
    });

    it('recusa mais de 200 ids e informa as tarefas ignoradas', async () => {
      const { owner, workspace, list } = await setup();
      const task = await createdTask(workspace, owner, list);

      await withAuth(http().patch(`/api/v1/workspaces/${workspace.id}/tasks/bulk`), owner)
        .send({
          ids: Array.from({ length: 201 }, () => task.id),
          changes: { priority: 'low' },
        })
        .expect(400);

      const response = await withAuth(
        http().patch(`/api/v1/workspaces/${workspace.id}/tasks/bulk`),
        owner,
      )
        .send({ ids: [task.id, '507f1f77bcf86cd799439011'], changes: { priority: 'low' } })
        .expect(200);

      expect(response.body).toEqual({
        updated: 1,
        skipped: [{ id: '507f1f77bcf86cd799439011', code: 'TASK_NOT_FOUND' }],
      });
    });
  });

  describe('permissões', () => {
    it('guest sem acesso recebe 404 e não enxerga a tarefa nas consultas', async () => {
      const { owner, workspace, list } = await setup();
      const guest = await addMember(workspace, owner, 'guest');
      const task = await createdTask(workspace, owner, list);

      const direct = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/tasks/${task.id}`),
        guest.session,
      ).expect(404);

      expect(direct.body.code).toBe('TASK_NOT_FOUND');

      await withAuth(
        http().patch(`/api/v1/workspaces/${workspace.id}/tasks/${task.id}`),
        guest.session,
      )
        .send({ name: 'Mudança' })
        .expect(404);

      await createTask(workspace, guest.session, list, { name: 'Nova' }).expect(404);

      const query = await queryTasks(workspace, guest.session).expect(200);

      expect(query.body.items).toHaveLength(0);

      const bulk = await withAuth(
        http().patch(`/api/v1/workspaces/${workspace.id}/tasks/bulk`),
        guest.session,
      )
        .send({ ids: [task.id], changes: { priority: 'low' } })
        .expect(200);

      expect(bulk.body).toEqual({
        updated: 0,
        skipped: [{ id: task.id, code: 'TASK_NOT_FOUND' }],
      });
    });

    it('guest com permissão de view não edita a tarefa', async () => {
      const { owner, workspace, list } = await setup();
      const guest = await addMember(workspace, owner, 'guest');
      const task = await createdTask(workspace, owner, list);

      await withAuth(http().post(`/api/v1/workspaces/${workspace.id}/permissions`), owner)
        .send({
          resourceType: 'list',
          resourceId: list.id,
          principalType: 'user',
          principalId: guest.userId,
          level: 'view',
        })
        .expect(201);

      await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/tasks/${task.id}`),
        guest.session,
      ).expect(200);

      const forbidden = await withAuth(
        http().patch(`/api/v1/workspaces/${workspace.id}/tasks/${task.id}`),
        guest.session,
      )
        .send({ name: 'Mudança' })
        .expect(403);

      expect(forbidden.body.code).toBe('FORBIDDEN_RESOURCE');
    });
  });

  describe('integração com a hierarquia', () => {
    it('conta as tarefas abertas no /tree', async () => {
      const { owner, workspace, list, statuses } = await setup();
      const done = statuses.find((status) => status.group === 'done');

      await createdTask(workspace, owner, list, { name: 'Aberta' });
      await createdTask(workspace, owner, list, { name: 'Concluída', statusId: done?.id });

      const tree = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/tree`),
        owner,
      ).expect(200);

      expect(tree.body.spaces[0].lists[0].openTaskCount).toBe(1);
    });

    it('atualiza statusGroup das tarefas quando o status set muda', async () => {
      const { owner, workspace, space, list, statuses } = await setup();
      const task = await createdTask(workspace, owner, list);

      await withAuth(
        http().patch(`/api/v1/workspaces/${workspace.id}/status-sets/${space.statusSetId}`),
        owner,
      )
        .send({
          statuses: statuses.map((status) => ({
            id: status.id,
            name: status.name,
            color: status.color,
            group: status.id === task.statusId ? 'closed' : status.group,
          })),
        })
        .expect(200);

      const updated = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/tasks/${task.id}`),
        owner,
      ).expect(200);

      expect(updated.body.statusGroup).toBe('closed');
      expect(updated.body.closedAt).not.toBeNull();
    });
  });
});

function ids(body: unknown): string[] {
  return (body as QueryPage).items.map((item) => item.id);
}

function sectionOf(body: MyTasksBody, taskId: string): string | undefined {
  return Object.entries(body.sections).find(([, tasks]) =>
    tasks.some((task) => task.id === taskId),
  )?.[0];
}
