import request from 'supertest';
import { Types } from 'mongoose';
import { RecurrenceScheduler } from '../src/modules/tasks/recurrence.scheduler';
import { PurgeService } from '../src/modules/trash/purge.service';
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
  dueAt: string | null;
  startAt: string | null;
  statusId: string;
  statusGroup: string;
  recurrence: { rrule: string; mode: string; createNew: boolean } | null;
}

interface SearchHitBody {
  type: string;
  id: string;
  name: string;
  customId?: string;
}

interface SearchBody {
  q: string;
  results: Record<string, SearchHitBody[]>;
}

interface TrashItemBody {
  entityType: string;
  id: string;
  name: string;
  at: string;
  customId?: string;
}

interface FavoriteBody {
  id: string;
  entityType: string;
  entityId: string;
  position: string;
  entity: { id: string; name: string } | null;
}

interface RecentBody {
  entityType: string;
  entityId: string;
  entity: { id: string; name: string };
}

interface MemberFixture {
  session: Session;
  userId: string;
}

interface Fixture {
  owner: Session;
  admin: MemberFixture;
  member: MemberFixture;
  guest: MemberFixture;
  workspace: IdBody;
  space: IdBody;
  folder: IdBody;
  list: IdBody;
  statuses: StatusBody[];
}

describe('Busca, favoritos, recentes, lixeira e recorrência', () => {
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
    const workspace = (
      await withAuth(http().post('/api/v1/workspaces'), owner)
        .send({ name: 'Azuos Dev', taskPrefix: 'AZD' })
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

  function createTask(
    fixture: Fixture,
    session: Session,
    body: Record<string, unknown>,
    listId = fixture.list.id,
  ): request.Test {
    return withAuth(
      http().post(`/api/v1/workspaces/${fixture.workspace.id}/lists/${listId}/tasks`),
      session,
    ).send(body);
  }

  function doneStatus(fixture: Fixture): StatusBody {
    const status = fixture.statuses.find((one) => one.group === 'done');

    if (!status) {
      throw new Error('O template de status não tem um status concluído.');
    }

    return status;
  }

  async function search(fixture: Fixture, session: Session, query: string): Promise<SearchBody> {
    const response = await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/search?${query}`),
      session,
    ).expect(200);

    return response.body as SearchBody;
  }

  async function trash(fixture: Fixture, session: Session): Promise<TrashItemBody[]> {
    const response = await withAuth(
      http().get(`/api/v1/workspaces/${fixture.workspace.id}/trash`),
      session,
    ).expect(200);

    return response.body.items as TrashItemBody[];
  }

  /** Raises the task counter so the next ids are AZD-142 and up, like the seed. */
  async function bumpCounter(workspace: IdBody, seq: number): Promise<void> {
    await ctx.connection
      .collection('counters')
      .updateOne(
        { workspaceId: new Types.ObjectId(workspace.id), key: 'task' },
        { $set: { seq }, $setOnInsert: { createdAt: new Date(), updatedAt: new Date() } },
        { upsert: true },
      );
  }

  function share(
    fixture: Fixture,
    resourceType: 'space' | 'folder' | 'list',
    resourceId: string,
    principalId: string,
    level: 'view' | 'comment' | 'edit' | 'full',
  ): request.Test {
    return withAuth(
      http().post(`/api/v1/workspaces/${fixture.workspace.id}/permissions`),
      fixture.owner,
    ).send({ resourceType, resourceId, principalType: 'user', principalId, level });
  }

  describe('busca global', () => {
    it('não retorna o que o usuário não pode ver', async () => {
      const fixture = await setup();
      const task = (
        await createTask(fixture, fixture.owner, { name: 'Corrigir fechamento de caixa' }).expect(
          201,
        )
      ).body as TaskBody;

      const hidden = await search(fixture, fixture.guest.session, 'q=fechamento');

      expect(hidden.results.task).toHaveLength(0);

      const owned = await search(fixture, fixture.owner, 'q=fechamento');

      expect(owned.results.task?.map((hit) => hit.id)).toEqual([task.id]);

      await share(fixture, 'list', fixture.list.id, fixture.guest.userId, 'view').expect(201);

      const shared = await search(fixture, fixture.guest.session, 'q=fechamento');

      expect(shared.results.task?.map((hit) => hit.id)).toEqual([task.id]);
    });

    it('esconde Space, Folder e List de quem não tem permissão', async () => {
      const fixture = await setup();

      const hidden = await search(fixture, fixture.guest.session, 'q=u&types=space,folder,list');

      expect(hidden.results.space).toHaveLength(0);
      expect(hidden.results.folder).toHaveLength(0);
      expect(hidden.results.list).toHaveLength(0);

      const visible = await search(fixture, fixture.owner, 'q=Sprint&types=list');

      expect(visible.results.list?.map((hit) => hit.id)).toEqual([fixture.list.id]);
    });

    it('o prefixo AZD-14 encontra AZD-142..149', async () => {
      const fixture = await setup();

      await bumpCounter(fixture.workspace, 141);

      const created: string[] = [];

      for (let index = 2; index <= 9; index += 1) {
        const task = (
          await createTask(fixture, fixture.owner, { name: `Tarefa ${index}` }).expect(201)
        ).body as TaskBody;

        created.push(task.customId);
      }

      expect(created).toEqual([
        'AZD-142',
        'AZD-143',
        'AZD-144',
        'AZD-145',
        'AZD-146',
        'AZD-147',
        'AZD-148',
        'AZD-149',
      ]);

      const found = await search(fixture, fixture.owner, 'q=AZD-14&types=task');

      expect(found.results.task?.map((hit) => hit.customId)).toEqual(created);
    });

    it('acha pelo texto da descrição e pelo comentário', async () => {
      const fixture = await setup();
      const task = (
        await createTask(fixture, fixture.owner, {
          name: 'Ajustar relatório',
          descriptionText: 'conferir a sangria do caixa antes de fechar',
        }).expect(201)
      ).body as TaskBody;

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${task.id}/comments`),
        fixture.owner,
      )
        .send({ bodyText: 'o cliente pediu a segunda via do boleto' })
        .expect(201);

      const byDescription = await search(fixture, fixture.owner, 'q=sangria&types=task');

      expect(byDescription.results.task?.map((hit) => hit.id)).toEqual([task.id]);

      const byComment = await search(fixture, fixture.owner, 'q=boleto&types=comment');

      expect(byComment.results.comment).toHaveLength(1);
      expect(byComment.results.comment?.[0].customId).toBe(task.customId);

      const hidden = await search(fixture, fixture.guest.session, 'q=boleto&types=comment');

      expect(hidden.results.comment).toHaveLength(0);
    });

    it('acha membros do workspace por nome ou e-mail', async () => {
      const fixture = await setup();
      const found = await search(
        fixture,
        fixture.member.session,
        `q=${encodeURIComponent(fixture.owner.credentials.email)}&types=user`,
      );

      expect(found.results.user).toHaveLength(1);
    });

    it('exige o termo da busca', async () => {
      const fixture = await setup();

      await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/search`),
        fixture.owner,
      ).expect(400);
    });
  });

  describe('favoritos', () => {
    it('favorita, lista na ordem manual, reordena e remove', async () => {
      const fixture = await setup();
      const task = (await createTask(fixture, fixture.owner, { name: 'Revisar PR' }).expect(201))
        .body as TaskBody;

      const favoriteList = (
        await withAuth(
          http().post(`/api/v1/workspaces/${fixture.workspace.id}/favorites`),
          fixture.owner,
        )
          .send({ entityType: 'list', entityId: fixture.list.id })
          .expect(201)
      ).body as FavoriteBody;
      const favoriteTask = (
        await withAuth(
          http().post(`/api/v1/workspaces/${fixture.workspace.id}/favorites`),
          fixture.owner,
        )
          .send({ entityType: 'task', entityId: task.id })
          .expect(201)
      ).body as FavoriteBody;

      expect(favoriteList.entity?.name).toBe('uSolutionsPDV — Sprint 3');
      expect(favoriteTask.entity?.name).toBe('Revisar PR');

      const listed = (
        await withAuth(
          http().get(`/api/v1/workspaces/${fixture.workspace.id}/favorites`),
          fixture.owner,
        ).expect(200)
      ).body.items as FavoriteBody[];

      expect(listed.map((one) => one.id)).toEqual([favoriteList.id, favoriteTask.id]);

      await withAuth(
        http().post(
          `/api/v1/workspaces/${fixture.workspace.id}/favorites/${favoriteTask.id}/reorder`,
        ),
        fixture.owner,
      )
        .send({ nextId: favoriteList.id })
        .expect(200);

      const reordered = (
        await withAuth(
          http().get(`/api/v1/workspaces/${fixture.workspace.id}/favorites`),
          fixture.owner,
        ).expect(200)
      ).body.items as FavoriteBody[];

      expect(reordered.map((one) => one.id)).toEqual([favoriteTask.id, favoriteList.id]);

      await withAuth(
        http().delete(`/api/v1/workspaces/${fixture.workspace.id}/favorites/${favoriteTask.id}`),
        fixture.owner,
      ).expect(200);

      const after = (
        await withAuth(
          http().get(`/api/v1/workspaces/${fixture.workspace.id}/favorites`),
          fixture.owner,
        ).expect(200)
      ).body.items as FavoriteBody[];

      expect(after.map((one) => one.id)).toEqual([favoriteList.id]);
    });

    it('favoritar duas vezes mantém um único registro', async () => {
      const fixture = await setup();
      const first = (
        await withAuth(
          http().post(`/api/v1/workspaces/${fixture.workspace.id}/favorites`),
          fixture.owner,
        )
          .send({ entityType: 'list', entityId: fixture.list.id })
          .expect(201)
      ).body as FavoriteBody;
      const second = (
        await withAuth(
          http().post(`/api/v1/workspaces/${fixture.workspace.id}/favorites`),
          fixture.owner,
        )
          .send({ entityType: 'list', entityId: fixture.list.id })
          .expect(201)
      ).body as FavoriteBody;

      expect(second.id).toBe(first.id);
    });

    it('não deixa favoritar o que o usuário não pode ver', async () => {
      const fixture = await setup();

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/favorites`),
        fixture.guest.session,
      )
        .send({ entityType: 'list', entityId: fixture.list.id })
        .expect(404);
    });
  });

  describe('recentes', () => {
    it('registra a abertura da tarefa e da List', async () => {
      const fixture = await setup();
      const task = (await createTask(fixture, fixture.owner, { name: 'Subir build' }).expect(201))
        .body as TaskBody;

      await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${task.id}`),
        fixture.owner,
      ).expect(200);
      await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/lists/${fixture.list.id}`),
        fixture.owner,
      ).expect(200);

      const recent = (
        await withAuth(
          http().get(`/api/v1/workspaces/${fixture.workspace.id}/me/recent`),
          fixture.owner,
        ).expect(200)
      ).body.items as RecentBody[];

      expect(recent.map((one) => one.entityType)).toEqual(['list', 'task']);
      expect(recent[1].entity.name).toBe('Subir build');
    });

    it('cada usuário tem os seus recentes', async () => {
      const fixture = await setup();
      const task = (await createTask(fixture, fixture.owner, { name: 'Subir build' }).expect(201))
        .body as TaskBody;

      await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${task.id}`),
        fixture.owner,
      ).expect(200);

      const recent = (
        await withAuth(
          http().get(`/api/v1/workspaces/${fixture.workspace.id}/me/recent`),
          fixture.member.session,
        ).expect(200)
      ).body.items as RecentBody[];

      expect(recent).toHaveLength(0);
    });
  });

  describe('lixeira', () => {
    it('restaurar recoloca a tarefa na List', async () => {
      const fixture = await setup();
      const task = (
        await createTask(fixture, fixture.owner, { name: 'Corrigir fechamento de caixa' }).expect(
          201,
        )
      ).body as TaskBody;

      await withAuth(
        http().delete(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${task.id}`),
        fixture.owner,
      ).expect(200);

      const items = await trash(fixture, fixture.owner);

      expect(items.map((one) => one.id)).toEqual([task.id]);
      expect(items[0].entityType).toBe('task');
      expect(items[0].customId).toBe(task.customId);

      await withAuth(
        http().get(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${task.id}`),
        fixture.owner,
      ).expect(404);

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/trash/task/${task.id}/restore`),
        fixture.owner,
      ).expect(200);

      const query = await withAuth(
        http().get(
          `/api/v1/workspaces/${fixture.workspace.id}/tasks/query?location=list&locationId=${fixture.list.id}`,
        ),
        fixture.owner,
      ).expect(200);

      expect((query.body.items as TaskBody[]).map((one) => one.id)).toEqual([task.id]);
      expect(await trash(fixture, fixture.owner)).toHaveLength(0);
    });

    it('mostra só o topo do que foi excluído em cascata', async () => {
      const fixture = await setup();

      await createTask(fixture, fixture.owner, { name: 'Tarefa da List' }).expect(201);

      await withAuth(
        http().delete(`/api/v1/workspaces/${fixture.workspace.id}/lists/${fixture.list.id}`),
        fixture.owner,
      ).expect(200);

      const items = await trash(fixture, fixture.owner);

      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ entityType: 'list', id: fixture.list.id });
    });

    it('não mostra o que o usuário não pode ver', async () => {
      const fixture = await setup();
      const task = (await createTask(fixture, fixture.owner, { name: 'Sigiloso' }).expect(201))
        .body as TaskBody;

      await withAuth(
        http().delete(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${task.id}`),
        fixture.owner,
      ).expect(200);

      expect(await trash(fixture, fixture.guest.session)).toHaveLength(0);
    });

    it('apagar de vez é só para admin e leva o que a tarefa contém', async () => {
      const fixture = await setup();
      const task = (await createTask(fixture, fixture.owner, { name: 'Com anexos' }).expect(201))
        .body as TaskBody;

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${task.id}/comments`),
        fixture.owner,
      )
        .send({ bodyText: 'comentário que vai embora' })
        .expect(201);
      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${task.id}/checklists`),
        fixture.owner,
      )
        .send({ name: 'Passos' })
        .expect(201);
      await withAuth(
        http().delete(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${task.id}`),
        fixture.owner,
      ).expect(200);

      await withAuth(
        http().delete(`/api/v1/workspaces/${fixture.workspace.id}/trash/task/${task.id}`),
        fixture.member.session,
      ).expect(403);

      await withAuth(
        http().delete(`/api/v1/workspaces/${fixture.workspace.id}/trash/task/${task.id}`),
        fixture.admin.session,
      ).expect(200);

      expect(await trash(fixture, fixture.owner)).toHaveLength(0);
      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/trash/task/${task.id}/restore`),
        fixture.owner,
      ).expect(404);

      const taskId = new Types.ObjectId(task.id);

      expect(await ctx.connection.collection('tasks').countDocuments({ _id: taskId })).toBe(0);
      expect(await ctx.connection.collection('comments').countDocuments({ entityId: taskId })).toBe(
        0,
      );
      expect(await ctx.connection.collection('checklists').countDocuments({ taskId })).toBe(0);
    });

    it('recusa um tipo de item desconhecido', async () => {
      const fixture = await setup();

      await withAuth(
        http().post(
          `/api/v1/workspaces/${fixture.workspace.id}/trash/view/${fixture.list.id}/restore`,
        ),
        fixture.owner,
      ).expect(400);
    });

    it('o expurgo diário apaga o que passou de 30 dias', async () => {
      const fixture = await setup();
      const keep = (
        await createTask(fixture, fixture.owner, { name: 'Recente na lixeira' }).expect(201)
      ).body as TaskBody;
      const drop = (
        await createTask(fixture, fixture.owner, { name: 'Antiga na lixeira' }).expect(201)
      ).body as TaskBody;

      for (const task of [keep, drop]) {
        await withAuth(
          http().delete(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${task.id}`),
          fixture.owner,
        ).expect(200);
      }

      await ctx.connection
        .collection('tasks')
        .updateOne(
          { _id: new Types.ObjectId(drop.id) },
          { $set: { deletedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) } },
        );

      const counts = await ctx.app.get(PurgeService).purgeExpired();

      expect(counts.tasks).toBe(1);
      expect(
        await ctx.connection
          .collection('tasks')
          .countDocuments({ _id: new Types.ObjectId(drop.id) }),
      ).toBe(0);
      expect((await trash(fixture, fixture.owner)).map((one) => one.id)).toEqual([keep.id]);
    });
  });

  describe('arquivados', () => {
    it('lista a List arquivada e não a mostra na lixeira', async () => {
      const fixture = await setup();

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/lists/${fixture.list.id}/archive`),
        fixture.owner,
      ).expect(200);

      const archived = (
        await withAuth(
          http().get(`/api/v1/workspaces/${fixture.workspace.id}/archived`),
          fixture.owner,
        ).expect(200)
      ).body.items as TrashItemBody[];

      expect(archived.map((one) => one.id)).toEqual([fixture.list.id]);
      expect(await trash(fixture, fixture.owner)).toHaveLength(0);
    });

    it('não mostra o que o usuário não pode ver', async () => {
      const fixture = await setup();

      await withAuth(
        http().post(`/api/v1/workspaces/${fixture.workspace.id}/lists/${fixture.list.id}/archive`),
        fixture.owner,
      ).expect(200);

      const archived = (
        await withAuth(
          http().get(`/api/v1/workspaces/${fixture.workspace.id}/archived`),
          fixture.guest.session,
        ).expect(200)
      ).body.items as TrashItemBody[];

      expect(archived).toHaveLength(0);
    });
  });

  describe('recorrência', () => {
    const dueAt = '2026-12-07T12:00:00.000Z';

    it('concluir uma semanal gera a próxima ocorrência na data correta', async () => {
      const fixture = await setup();
      const task = (
        await createTask(fixture, fixture.owner, {
          name: 'Fechar o caixa da semana',
          startAt: '2026-12-07T09:00:00.000Z',
          dueAt,
          recurrence: { rrule: 'FREQ=WEEKLY', mode: 'onComplete', createNew: true },
        }).expect(201)
      ).body as TaskBody;

      await withAuth(
        http().patch(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${task.id}`),
        fixture.owner,
      )
        .send({ statusId: doneStatus(fixture).id })
        .expect(200);

      const items = (
        await withAuth(
          http().get(
            `/api/v1/workspaces/${fixture.workspace.id}/tasks/query?location=list&locationId=${fixture.list.id}&includeClosed=true`,
          ),
          fixture.owner,
        ).expect(200)
      ).body.items as TaskBody[];

      expect(items).toHaveLength(2);

      const closed = items.find((one) => one.id === task.id);
      const next = items.find((one) => one.id !== task.id);

      expect(closed?.statusGroup).toBe('done');
      expect(closed?.recurrence).toBeNull();
      expect(next?.name).toBe('Fechar o caixa da semana');
      expect(next?.dueAt).toBe('2026-12-14T12:00:00.000Z');
      expect(next?.startAt).toBe('2026-12-14T09:00:00.000Z');
      expect(next?.statusGroup).toBe('notStarted');
      expect(next?.recurrence).toMatchObject({ rrule: 'FREQ=WEEKLY', mode: 'onComplete' });
    });

    it('sem createNew a própria tarefa reabre nas novas datas', async () => {
      const fixture = await setup();
      const task = (
        await createTask(fixture, fixture.owner, {
          name: 'Backup semanal',
          dueAt,
          recurrence: { rrule: 'FREQ=WEEKLY', mode: 'onComplete', createNew: false },
        }).expect(201)
      ).body as TaskBody;

      const updated = (
        await withAuth(
          http().patch(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${task.id}`),
          fixture.owner,
        )
          .send({ statusId: doneStatus(fixture).id })
          .expect(200)
      ).body as TaskBody;

      expect(updated.dueAt).toBe('2026-12-14T12:00:00.000Z');
      expect(updated.statusGroup).toBe('notStarted');
      expect(updated.recurrence).toMatchObject({ createNew: false });

      const items = (
        await withAuth(
          http().get(
            `/api/v1/workspaces/${fixture.workspace.id}/tasks/query?location=list&locationId=${fixture.list.id}`,
          ),
          fixture.owner,
        ).expect(200)
      ).body.items as TaskBody[];

      expect(items.map((one) => one.id)).toEqual([task.id]);
    });

    it('a série encerrada apenas conclui a tarefa', async () => {
      const fixture = await setup();
      const task = (
        await createTask(fixture, fixture.owner, {
          name: 'Única ocorrência',
          dueAt,
          recurrence: { rrule: 'FREQ=WEEKLY;COUNT=1', mode: 'onComplete', createNew: true },
        }).expect(201)
      ).body as TaskBody;

      const updated = (
        await withAuth(
          http().patch(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${task.id}`),
          fixture.owner,
        )
          .send({ statusId: doneStatus(fixture).id })
          .expect(200)
      ).body as TaskBody;

      expect(updated.statusGroup).toBe('done');
      expect(updated.recurrence).toBeNull();

      const items = (
        await withAuth(
          http().get(
            `/api/v1/workspaces/${fixture.workspace.id}/tasks/query?location=list&locationId=${fixture.list.id}&includeClosed=true`,
          ),
          fixture.owner,
        ).expect(200)
      ).body.items as TaskBody[];

      expect(items).toHaveLength(1);
    });

    it('o modo agendado rola a data pelo cron', async () => {
      const fixture = await setup();
      const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const task = (
        await createTask(fixture, fixture.owner, {
          name: 'Relatório diário',
          dueAt: past.toISOString(),
          recurrence: { rrule: 'FREQ=DAILY', mode: 'onSchedule', createNew: false },
        }).expect(201)
      ).body as TaskBody;

      expect(await ctx.app.get(RecurrenceScheduler).rollOverDue()).toBe(1);

      const rolled = (
        await withAuth(
          http().get(`/api/v1/workspaces/${fixture.workspace.id}/tasks/${task.id}`),
          fixture.owner,
        ).expect(200)
      ).body as TaskBody;

      expect(new Date(rolled.dueAt ?? 0).getTime()).toBeGreaterThan(Date.now());
    });

    it('recusa uma regra inválida', async () => {
      const fixture = await setup();

      const response = await createTask(fixture, fixture.owner, {
        name: 'Recorrência inválida',
        recurrence: { rrule: 'toda semana', mode: 'onComplete' },
      }).expect(400);

      expect(response.body.code).toBe('INVALID_RECURRENCE');
    });
  });
});
