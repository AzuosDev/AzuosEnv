import request from 'supertest';
import { Session, createSession } from './utils/auth-client';
import { TestApp, createTestApp } from './utils/e2e-app';

interface WorkspaceBody {
  id: string;
}

interface SpaceBody {
  id: string;
  name: string;
  private: boolean;
  statusSetId: string;
  position: string;
  archivedAt: string | null;
  deletedAt: string | null;
}

interface FolderBody {
  id: string;
  name: string;
  spaceId: string;
  parentFolderId: string | null;
  position: string;
  deletedAt: string | null;
}

interface ListBody {
  id: string;
  name: string;
  spaceId: string;
  folderId: string | null;
  position: string;
  deletedAt: string | null;
}

interface StatusesBody {
  statusSetId: string;
  name: string;
  source: 'list' | 'folder' | 'space';
  statuses: { id: string; name: string; group: string; position: number }[];
}

interface TreeBody {
  spaces: {
    id: string;
    name: string;
    folders: {
      id: string;
      name: string;
      lists: { id: string; name: string; openTaskCount: number }[];
      folders: unknown[];
    }[];
    lists: { id: string; name: string; openTaskCount: number }[];
  }[];
}

interface MemberFixture {
  session: Session;
  userId: string;
}

type GuestRole = 'admin' | 'member' | 'limited' | 'guest';

describe('Hierarquia', () => {
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
    role: GuestRole,
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

  async function createFolder(
    workspace: WorkspaceBody,
    session: Session,
    body: Record<string, unknown>,
  ): Promise<FolderBody> {
    const response = await withAuth(
      http().post(`/api/v1/workspaces/${workspace.id}/folders`),
      session,
    )
      .send({ name: 'Cênio Construções', ...body })
      .expect(201);

    return response.body as FolderBody;
  }

  async function createList(
    workspace: WorkspaceBody,
    session: Session,
    body: Record<string, unknown>,
  ): Promise<ListBody> {
    const response = await withAuth(
      http().post(`/api/v1/workspaces/${workspace.id}/lists`),
      session,
    )
      .send({ name: 'uSolutionsPDV — Sprint 3', ...body })
      .expect(201);

    return response.body as ListBody;
  }

  async function createStatusSet(
    workspace: WorkspaceBody,
    session: Session,
    name: string,
    statusName: string,
  ): Promise<{ id: string }> {
    const response = await withAuth(
      http().post(`/api/v1/workspaces/${workspace.id}/status-sets`),
      session,
    )
      .send({
        name,
        statuses: [
          { name: statusName, color: '#2563EB', group: 'active' },
          { name: 'Concluído', color: '#16A34A', group: 'done' },
        ],
      })
      .expect(201);

    return response.body as { id: string };
  }

  async function share(
    workspace: WorkspaceBody,
    session: Session,
    body: Record<string, unknown>,
  ): Promise<{ id: string }> {
    const response = await withAuth(
      http().post(`/api/v1/workspaces/${workspace.id}/permissions`),
      session,
    )
      .send(body)
      .expect(201);

    return response.body as { id: string };
  }

  describe('Spaces', () => {
    it('creates the Space with the statuses of the chosen template', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);

      const space = await createSpace(workspace, owner, {
        name: 'Comercial',
        statusTemplate: 'comercial',
        color: '#2563EB',
      });
      const list = await createList(workspace, owner, { spaceId: space.id, name: 'Leads' });
      const statuses = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/lists/${list.id}/statuses`),
        owner,
      ).expect(200);

      const body = statuses.body as StatusesBody;

      expect(space.statusSetId).toBeDefined();
      expect(body.source).toBe('space');
      expect(body.statuses.map((status) => status.name)).toEqual([
        'Lead',
        'Reunião',
        'Proposta enviada',
        'Negociação',
        'Fechado',
        'Perdido',
      ]);
    });

    it('refuses a guest creating a Space', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const guest = await addMember(workspace, owner, 'guest');

      const response = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/spaces`),
        guest.session,
      )
        .send({ name: 'Interno' })
        .expect(403);

      expect(response.body.code).toBe('FORBIDDEN_ROLE');
    });

    it('rejects an invalid payload', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);

      const response = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/spaces`),
        owner,
      )
        .send({ name: '', statusTemplate: 'outro' })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('does not reach a Space of another workspace', async () => {
      const owner = await createSession(ctx);
      const other = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const otherWorkspace = await createWorkspace(other);
      const space = await createSpace(workspace, owner);

      const response = await withAuth(
        http().get(`/api/v1/workspaces/${otherWorkspace.id}/spaces/${space.id}`),
        other,
      ).expect(404);

      expect(response.body.code).toBe('SPACE_NOT_FOUND');
    });
  });

  describe('Herança de statuses', () => {
    it('resolves list, then folder, then space', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const folderSet = await createStatusSet(workspace, owner, 'Folder', 'Folder em andamento');
      const listSet = await createStatusSet(workspace, owner, 'List', 'List em andamento');

      const space = await createSpace(workspace, owner, { statusTemplate: 'simples' });
      const folder = await createFolder(workspace, owner, { spaceId: space.id });
      const list = await createList(workspace, owner, {
        spaceId: space.id,
        folderId: folder.id,
      });

      const fromSpace = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/lists/${list.id}/statuses`),
        owner,
      ).expect(200);

      expect((fromSpace.body as StatusesBody).source).toBe('space');
      expect((fromSpace.body as StatusesBody).statuses).toHaveLength(3);

      await withAuth(http().patch(`/api/v1/workspaces/${workspace.id}/folders/${folder.id}`), owner)
        .send({ statusSetId: folderSet.id })
        .expect(200);

      const fromFolder = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/lists/${list.id}/statuses`),
        owner,
      ).expect(200);

      expect((fromFolder.body as StatusesBody).source).toBe('folder');
      expect((fromFolder.body as StatusesBody).statuses[0].name).toBe('Folder em andamento');

      await withAuth(http().patch(`/api/v1/workspaces/${workspace.id}/lists/${list.id}`), owner)
        .send({ statusSetId: listSet.id })
        .expect(200);

      const fromList = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/lists/${list.id}/statuses`),
        owner,
      ).expect(200);

      expect((fromList.body as StatusesBody).source).toBe('list');
      expect((fromList.body as StatusesBody).statuses[0].name).toBe('List em andamento');
    });

    it('rejects a status set from another workspace', async () => {
      const owner = await createSession(ctx);
      const other = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const otherWorkspace = await createWorkspace(other);
      const statusSet = await createStatusSet(otherWorkspace, other, 'Outro', 'Em andamento');

      const response = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/spaces`),
        owner,
      )
        .send({ name: 'Produtos', statusSetId: statusSet.id })
        .expect(400);

      expect(response.body.code).toBe('INVALID_STATUS_SET');
    });
  });

  describe('Space privado', () => {
    it('stays invisible for a member without access', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const member = await addMember(workspace, owner, 'member');

      const open = await createSpace(workspace, owner, { name: 'Produtos' });
      const secret = await createSpace(workspace, owner, { name: 'Diretoria', private: true });

      const listed = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/spaces`),
        member.session,
      ).expect(200);
      const direct = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/spaces/${secret.id}`),
        member.session,
      ).expect(404);
      const tree = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/tree`),
        member.session,
      ).expect(200);

      expect((listed.body.items as SpaceBody[]).map((space) => space.id)).toEqual([open.id]);
      expect(direct.body.code).toBe('SPACE_NOT_FOUND');
      expect((tree.body as TreeBody).spaces.map((space) => space.id)).toEqual([open.id]);
    });

    it('becomes visible once it is shared', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const member = await addMember(workspace, owner, 'member');
      const secret = await createSpace(workspace, owner, { name: 'Diretoria', private: true });

      await share(workspace, owner, {
        resourceType: 'space',
        resourceId: secret.id,
        principalType: 'user',
        principalId: member.userId,
        level: 'view',
      });

      const direct = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/spaces/${secret.id}`),
        member.session,
      ).expect(200);
      const denied = await withAuth(
        http().patch(`/api/v1/workspaces/${workspace.id}/spaces/${secret.id}`),
        member.session,
      )
        .send({ name: 'Diretoria 2026' })
        .expect(403);

      expect((direct.body as SpaceBody).id).toBe(secret.id);
      expect(denied.body.code).toBe('FORBIDDEN_RESOURCE');
    });

    it('refuses sharing with someone outside the workspace', async () => {
      const owner = await createSession(ctx);
      const outsider = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const outsiderWorkspace = await createWorkspace(outsider);
      const space = await createSpace(workspace, owner);
      const me = await withAuth(http().get('/api/v1/auth/me'), outsider).expect(200);

      expect((outsiderWorkspace as WorkspaceBody).id).toBeDefined();

      const response = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/permissions`),
        owner,
      )
        .send({
          resourceType: 'space',
          resourceId: space.id,
          principalType: 'user',
          principalId: me.body.id,
          level: 'view',
        })
        .expect(400);

      expect(response.body.code).toBe('INVALID_PRINCIPAL');
    });
  });

  describe('Guest', () => {
    it('only sees the List shared with them', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const guest = await addMember(workspace, owner, 'guest');

      const space = await createSpace(workspace, owner);
      const folder = await createFolder(workspace, owner, { spaceId: space.id });
      const shared = await createList(workspace, owner, {
        spaceId: space.id,
        folderId: folder.id,
      });
      const hidden = await createList(workspace, owner, {
        spaceId: space.id,
        name: 'Plano empresarial',
      });

      await share(workspace, owner, {
        resourceType: 'list',
        resourceId: shared.id,
        principalType: 'user',
        principalId: guest.userId,
        level: 'view',
      });

      const lists = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/lists`),
        guest.session,
      ).expect(200);
      const tree = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/tree`),
        guest.session,
      ).expect(200);
      const hiddenResponse = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/lists/${hidden.id}`),
        guest.session,
      ).expect(404);
      const denied = await withAuth(
        http().patch(`/api/v1/workspaces/${workspace.id}/lists/${shared.id}`),
        guest.session,
      )
        .send({ name: 'Outro nome' })
        .expect(403);

      const treeBody = tree.body as TreeBody;

      expect((lists.body.items as ListBody[]).map((list) => list.id)).toEqual([shared.id]);
      expect(treeBody.spaces).toHaveLength(1);
      expect(treeBody.spaces[0].lists).toHaveLength(0);
      expect(treeBody.spaces[0].folders[0].lists.map((list) => list.id)).toEqual([shared.id]);
      expect(treeBody.spaces[0].folders[0].lists[0].openTaskCount).toBe(0);
      expect(hiddenResponse.body.code).toBe('LIST_NOT_FOUND');
      expect(denied.body.code).toBe('FORBIDDEN_RESOURCE');
    });
  });

  describe('Folders', () => {
    it('refuses a third level of folders', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const space = await createSpace(workspace, owner);
      const folder = await createFolder(workspace, owner, { spaceId: space.id });
      const subfolder = await createFolder(workspace, owner, {
        spaceId: space.id,
        parentFolderId: folder.id,
        name: 'Sprint',
      });

      expect(subfolder.parentFolderId).toBe(folder.id);

      const response = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/folders`),
        owner,
      )
        .send({ spaceId: space.id, parentFolderId: subfolder.id, name: 'Mais fundo' })
        .expect(400);

      expect(response.body.code).toBe('FOLDER_DEPTH_EXCEEDED');
    });

    it('moves the folder and its lists to another Space', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const origin = await createSpace(workspace, owner);
      const target = await createSpace(workspace, owner, { name: 'Produtos' });
      const folder = await createFolder(workspace, owner, { spaceId: origin.id });
      const list = await createList(workspace, owner, {
        spaceId: origin.id,
        folderId: folder.id,
      });

      const moved = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/folders/${folder.id}/move`),
        owner,
      )
        .send({ spaceId: target.id })
        .expect(200);

      const movedList = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/lists/${list.id}`),
        owner,
      ).expect(200);

      expect((moved.body as FolderBody).spaceId).toBe(target.id);
      expect((movedList.body as ListBody).spaceId).toBe(target.id);
    });
  });

  describe('Ordem manual', () => {
    it('keeps the order after reordering', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const space = await createSpace(workspace, owner);
      const first = await createList(workspace, owner, { spaceId: space.id, name: 'Leads' });
      const second = await createList(workspace, owner, { spaceId: space.id, name: 'Orçamentos' });
      const third = await createList(workspace, owner, { spaceId: space.id, name: 'Contratos' });

      const names = async (): Promise<string[]> => {
        const response = await withAuth(
          http().get(`/api/v1/workspaces/${workspace.id}/lists?spaceId=${space.id}`),
          owner,
        ).expect(200);

        return (response.body.items as ListBody[]).map((list) => list.name);
      };

      expect(await names()).toEqual(['Leads', 'Orçamentos', 'Contratos']);

      await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/lists/${third.id}/reorder`),
        owner,
      )
        .send({ previousId: first.id, nextId: second.id })
        .expect(200);

      expect(await names()).toEqual(['Leads', 'Contratos', 'Orçamentos']);

      await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/lists/${second.id}/reorder`),
        owner,
      )
        .send({ nextId: first.id })
        .expect(200);

      expect(await names()).toEqual(['Orçamentos', 'Leads', 'Contratos']);
    });

    it('rejects a sibling that does not exist', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const space = await createSpace(workspace, owner);
      const other = await createSpace(workspace, owner, { name: 'Produtos' });
      const list = await createList(workspace, owner, { spaceId: space.id, name: 'Leads' });
      const outsider = await createList(workspace, owner, { spaceId: other.id, name: 'Roadmap' });

      const response = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/lists/${list.id}/reorder`),
        owner,
      )
        .send({ previousId: outsider.id })
        .expect(400);

      expect(response.body.code).toBe('INVALID_POSITION');
    });
  });

  describe('Lixeira', () => {
    it('soft deletes the Space with its content and restores it', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const space = await createSpace(workspace, owner);
      const folder = await createFolder(workspace, owner, { spaceId: space.id });
      const list = await createList(workspace, owner, {
        spaceId: space.id,
        folderId: folder.id,
      });

      await withAuth(
        http().delete(`/api/v1/workspaces/${workspace.id}/spaces/${space.id}`),
        owner,
      ).expect(200);

      const afterDelete = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/spaces/${space.id}`),
        owner,
      ).expect(404);
      const deletedList = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/lists/${list.id}`),
        owner,
      ).expect(404);
      const emptyTree = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/tree`),
        owner,
      ).expect(200);

      expect(afterDelete.body.code).toBe('SPACE_NOT_FOUND');
      expect(deletedList.body.code).toBe('LIST_NOT_FOUND');
      expect((emptyTree.body as TreeBody).spaces).toHaveLength(0);

      await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/spaces/${space.id}/restore`),
        owner,
      ).expect(200);

      const restored = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/tree`),
        owner,
      ).expect(200);
      const restoredTree = restored.body as TreeBody;

      expect(restoredTree.spaces).toHaveLength(1);
      expect(restoredTree.spaces[0].folders[0].lists.map((item) => item.id)).toEqual([list.id]);
    });

    it('refuses deleting a List for someone with edit only', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const guest = await addMember(workspace, owner, 'guest');
      const space = await createSpace(workspace, owner);
      const list = await createList(workspace, owner, { spaceId: space.id });

      await share(workspace, owner, {
        resourceType: 'list',
        resourceId: list.id,
        principalType: 'user',
        principalId: guest.userId,
        level: 'edit',
      });

      const renamed = await withAuth(
        http().patch(`/api/v1/workspaces/${workspace.id}/lists/${list.id}`),
        guest.session,
      )
        .send({ name: 'Renomeada' })
        .expect(200);
      const denied = await withAuth(
        http().delete(`/api/v1/workspaces/${workspace.id}/lists/${list.id}`),
        guest.session,
      ).expect(403);

      expect((renamed.body as ListBody).name).toBe('Renomeada');
      expect(denied.body.code).toBe('FORBIDDEN_RESOURCE');
    });
  });

  describe('Arquivo', () => {
    it('hides archived Spaces from the tree and brings them back', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const space = await createSpace(workspace, owner);
      const list = await createList(workspace, owner, { spaceId: space.id });

      await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/spaces/${space.id}/archive`),
        owner,
      ).expect(200);

      const archivedTree = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/tree`),
        owner,
      ).expect(200);
      const archivedLists = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/lists`),
        owner,
      ).expect(200);
      const includingArchived = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/spaces?includeArchived=true`),
        owner,
      ).expect(200);

      expect((archivedTree.body as TreeBody).spaces).toHaveLength(0);
      expect(archivedLists.body.items).toHaveLength(0);
      expect((includingArchived.body.items as SpaceBody[]).map((item) => item.id)).toEqual([
        space.id,
      ]);

      await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/spaces/${space.id}/unarchive`),
        owner,
      ).expect(200);

      const restoredLists = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/lists`),
        owner,
      ).expect(200);

      expect((restoredLists.body.items as ListBody[]).map((item) => item.id)).toEqual([list.id]);
    });
  });

  describe('Status sets', () => {
    it('refuses removing a status set in use', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const space = await createSpace(workspace, owner);

      const response = await withAuth(
        http().delete(`/api/v1/workspaces/${workspace.id}/status-sets/${space.statusSetId}`),
        owner,
      ).expect(409);

      expect(response.body.code).toBe('STATUS_SET_IN_USE');
    });

    it('rejects a status without a group', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);

      const response = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/status-sets`),
        owner,
      )
        .send({ name: 'Inválido', statuses: [{ name: 'A fazer', color: '#94A3B8' }] })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('refuses a guest creating a status set', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const guest = await addMember(workspace, owner, 'guest');

      const response = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/status-sets`),
        guest.session,
      )
        .send({
          name: 'Do guest',
          statuses: [{ name: 'A fazer', color: '#94A3B8', group: 'notStarted' }],
        })
        .expect(403);

      expect(response.body.code).toBe('FORBIDDEN_ROLE');
    });
  });

  describe('Compartilhamento', () => {
    it('lists and removes the sharing of a Space', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const member = await addMember(workspace, owner, 'guest');
      const space = await createSpace(workspace, owner, { private: true });

      const permission = await share(workspace, owner, {
        resourceType: 'space',
        resourceId: space.id,
        principalType: 'user',
        principalId: member.userId,
        level: 'view',
      });

      const listed = await withAuth(
        http().get(
          `/api/v1/workspaces/${workspace.id}/permissions?resourceType=space&resourceId=${space.id}`,
        ),
        owner,
      ).expect(200);

      expect((listed.body as { id: string }[]).map((item) => item.id)).toContain(permission.id);

      await withAuth(
        http().delete(`/api/v1/workspaces/${workspace.id}/permissions/${permission.id}`),
        owner,
      ).expect(200);

      const afterRemoval = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/spaces/${space.id}`),
        member.session,
      ).expect(404);

      expect(afterRemoval.body.code).toBe('SPACE_NOT_FOUND');
    });

    it('refuses a guest sharing a List they only view', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const guest = await addMember(workspace, owner, 'guest');
      const other = await addMember(workspace, owner, 'guest');
      const space = await createSpace(workspace, owner);
      const list = await createList(workspace, owner, { spaceId: space.id });

      await share(workspace, owner, {
        resourceType: 'list',
        resourceId: list.id,
        principalType: 'user',
        principalId: guest.userId,
        level: 'view',
      });

      const response = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/permissions`),
        guest.session,
      )
        .send({
          resourceType: 'list',
          resourceId: list.id,
          principalType: 'user',
          principalId: other.userId,
          level: 'view',
        })
        .expect(403);

      expect(response.body.code).toBe('FORBIDDEN_RESOURCE');
    });

    it('rejects an unsupported resource type', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const space = await createSpace(workspace, owner);

      const response = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/permissions`),
        owner,
      )
        .send({
          resourceType: 'task',
          resourceId: space.id,
          principalType: 'user',
          principalId: space.id,
          level: 'view',
        })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
