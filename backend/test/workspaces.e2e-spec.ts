import request from 'supertest';
import { createTestApp, TestApp } from './utils/e2e-app';
import { Session, createSession, login, uniqueEmail } from './utils/auth-client';

interface WorkspaceBody {
  id: string;
  name: string;
  slug: string;
  taskPrefix: string;
  color: string;
  timezone: string;
  settings: { clickApps: Record<string, boolean> };
}

interface MemberFixture {
  session: Session;
  userId: string;
  memberId: string;
}

describe('Workspaces', () => {
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

  /** Every request carries the session IP so the throttler counters stay isolated. */
  const withAuth = (test: request.Test, session: Session): request.Test =>
    test
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('X-Forwarded-For', session.credentials.ip);

  async function createWorkspace(session: Session, name = 'Azuos Dev'): Promise<WorkspaceBody> {
    const response = await withAuth(http().post('/api/v1/workspaces'), session)
      .send({ name })
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

    return {
      session,
      userId: accepted.body.member.userId as string,
      memberId: accepted.body.member.id as string,
    };
  }

  describe('POST /workspaces', () => {
    it('creates the workspace with the creator as owner', async () => {
      const owner = await createSession(ctx);

      const workspace = await createWorkspace(owner);

      expect(workspace).toMatchObject({
        name: 'Azuos Dev',
        slug: 'azuos-dev',
        taskPrefix: 'AZU',
        timezone: 'America/Fortaleza',
      });
      expect(workspace.settings.clickApps).toMatchObject({
        priority: true,
        tags: true,
        timeTracking: true,
        estimates: true,
        sprints: true,
        customFields: true,
        multipleLists: true,
        customIds: true,
        ai: true,
      });

      const detail = await withAuth(http().get(`/api/v1/workspaces/${workspace.id}`), owner).expect(
        200,
      );

      expect(detail.body.role).toBe('owner');

      const members = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/members`),
        owner,
      ).expect(200);

      expect(members.body.items).toHaveLength(1);
      expect(members.body.items[0]).toMatchObject({ role: 'owner', status: 'active' });
      expect(members.body.items[0].capacityPerDay).toBe(8);
      expect(members.body.nextCursor).toBeNull();
    });

    it('accepts an explicit slug and task prefix', async () => {
      const owner = await createSession(ctx);

      const response = await withAuth(http().post('/api/v1/workspaces'), owner)
        .send({ name: 'Azuos Dev', slug: 'azuos', taskPrefix: 'azd', color: '#2563EB' })
        .expect(201);

      expect(response.body).toMatchObject({ slug: 'azuos', taskPrefix: 'AZD' });
    });

    it('generates a unique slug when the name repeats', async () => {
      const owner = await createSession(ctx);

      const first = await createWorkspace(owner);
      const second = await createWorkspace(owner);

      expect(first.slug).toBe('azuos-dev');
      expect(second.slug).toBe('azuos-dev-2');
    });

    it('rejects invalid payloads', async () => {
      const owner = await createSession(ctx);

      await withAuth(http().post('/api/v1/workspaces'), owner).send({ name: 'A' }).expect(400);
      await withAuth(http().post('/api/v1/workspaces'), owner)
        .send({ name: 'Azuos Dev', color: 'azul' })
        .expect(400);
      const response = await withAuth(http().post('/api/v1/workspaces'), owner)
        .send({ name: 'Azuos Dev', unknown: true })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects a request without a token', async () => {
      await http().post('/api/v1/workspaces').send({ name: 'Azuos Dev' }).expect(401);
    });
  });

  describe('GET /workspaces', () => {
    it('lists only the workspaces of the user', async () => {
      const owner = await createSession(ctx);
      const other = await createSession(ctx);

      const mine = await createWorkspace(owner);
      await createWorkspace(other, 'Outro Workspace');

      const response = await withAuth(http().get('/api/v1/workspaces'), owner).expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].id).toBe(mine.id);
    });

    it('paginates by cursor', async () => {
      const owner = await createSession(ctx);
      await createWorkspace(owner, 'Workspace Um');
      await createWorkspace(owner, 'Workspace Dois');

      const first = await withAuth(http().get('/api/v1/workspaces?limit=1'), owner).expect(200);

      expect(first.body.items).toHaveLength(1);
      expect(first.body.nextCursor).toBeTruthy();

      const second = await withAuth(
        http().get(`/api/v1/workspaces?limit=1&cursor=${first.body.nextCursor}`),
        owner,
      ).expect(200);

      expect(second.body.items).toHaveLength(1);
      expect(second.body.items[0].id).not.toBe(first.body.items[0].id);
    });
  });

  describe('WorkspaceGuard', () => {
    it('answers 404 for a member of another workspace', async () => {
      const owner = await createSession(ctx);
      const outsider = await createSession(ctx);

      const workspace = await createWorkspace(owner);
      await createWorkspace(outsider, 'Outro Workspace');

      const response = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}`),
        outsider,
      ).expect(404);

      expect(response.body.code).toBe('WORKSPACE_NOT_FOUND');

      await withAuth(http().get(`/api/v1/workspaces/${workspace.id}/members`), outsider).expect(
        404,
      );
    });

    it('answers 404 for an unknown or invalid id', async () => {
      const owner = await createSession(ctx);

      await withAuth(http().get('/api/v1/workspaces/64b7f1e2c0000000000000ff'), owner).expect(404);
      await withAuth(http().get('/api/v1/workspaces/nao-e-um-id'), owner).expect(404);
    });

    it('answers 404 after the workspace is deleted', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);

      await withAuth(http().delete(`/api/v1/workspaces/${workspace.id}`), owner).expect(200);

      await withAuth(http().get(`/api/v1/workspaces/${workspace.id}`), owner).expect(404);
    });
  });

  describe('PATCH /workspaces/:wsId', () => {
    it('updates data and click apps as admin', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);

      const response = await withAuth(http().patch(`/api/v1/workspaces/${workspace.id}`), owner)
        .send({
          name: 'Azuos Env',
          color: '#111827',
          taskPrefix: 'env',
          timezone: 'America/Sao_Paulo',
          settings: { clickApps: { sprints: false, ai: false } },
        })
        .expect(200);

      expect(response.body).toMatchObject({
        name: 'Azuos Env',
        color: '#111827',
        taskPrefix: 'ENV',
        timezone: 'America/Sao_Paulo',
      });
      expect(response.body.settings.clickApps).toMatchObject({
        sprints: false,
        ai: false,
        priority: true,
      });
    });

    it('denies a member without the admin role', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const member = await addMember(workspace, owner, 'member');

      const response = await withAuth(
        http().patch(`/api/v1/workspaces/${workspace.id}`),
        member.session,
      )
        .send({ name: 'Renomeado' })
        .expect(403);

      expect(response.body.code).toBe('FORBIDDEN_ROLE');
    });

    it('rejects an invalid click app', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);

      await withAuth(http().patch(`/api/v1/workspaces/${workspace.id}`), owner)
        .send({ settings: { clickApps: { inexistente: true } } })
        .expect(400);
    });
  });

  describe('DELETE /workspaces/:wsId', () => {
    it('is restricted to the owner', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const admin = await addMember(workspace, owner, 'admin');

      const response = await withAuth(
        http().delete(`/api/v1/workspaces/${workspace.id}`),
        admin.session,
      ).expect(403);

      expect(response.body.code).toBe('FORBIDDEN_ROLE');

      await withAuth(http().delete(`/api/v1/workspaces/${workspace.id}`), owner).expect(200);
    });
  });

  describe('Members', () => {
    it('lets an admin change the role of a member', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const member = await addMember(workspace, owner, 'member');

      const response = await withAuth(
        http().patch(`/api/v1/workspaces/${workspace.id}/members/${member.memberId}`),
        owner,
      )
        .send({ role: 'admin' })
        .expect(200);

      expect(response.body.role).toBe('admin');
    });

    it('denies a member changing roles', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const member = await addMember(workspace, owner, 'member');
      const other = await addMember(workspace, owner, 'guest');

      const response = await withAuth(
        http().patch(`/api/v1/workspaces/${workspace.id}/members/${other.memberId}`),
        member.session,
      )
        .send({ role: 'admin' })
        .expect(403);

      expect(response.body.code).toBe('FORBIDDEN_ROLE');
    });

    it('refuses to change the owner role and rejects an unknown role', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);

      const members = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/members`),
        owner,
      ).expect(200);
      const ownerMemberId = members.body.items[0].id as string;

      const forbidden = await withAuth(
        http().patch(`/api/v1/workspaces/${workspace.id}/members/${ownerMemberId}`),
        owner,
      )
        .send({ role: 'admin' })
        .expect(403);

      expect(forbidden.body.code).toBe('OWNER_ROLE_IMMUTABLE');

      await withAuth(
        http().patch(`/api/v1/workspaces/${workspace.id}/members/${ownerMemberId}`),
        owner,
      )
        .send({ role: 'owner' })
        .expect(400);
    });

    it('deactivates a member, who then loses access', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const member = await addMember(workspace, owner, 'member');

      const response = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/members/${member.memberId}/deactivate`),
        owner,
      ).expect(200);

      expect(response.body.status).toBe('deactivated');

      await withAuth(http().get(`/api/v1/workspaces/${workspace.id}`), member.session).expect(404);
    });

    it('refuses to deactivate the owner and answers 404 for an unknown member', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);

      const members = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/members`),
        owner,
      ).expect(200);
      const ownerMemberId = members.body.items[0].id as string;

      const forbidden = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/members/${ownerMemberId}/deactivate`),
        owner,
      ).expect(403);

      expect(forbidden.body.code).toBe('CANNOT_DEACTIVATE_OWNER');

      await withAuth(
        http().post(
          `/api/v1/workspaces/${workspace.id}/members/64b7f1e2c0000000000000ff/deactivate`,
        ),
        owner,
      ).expect(404);
    });
  });

  describe('POST /workspaces/:wsId/transfer-ownership', () => {
    it('moves the ownership and keeps the previous owner as admin', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const member = await addMember(workspace, owner, 'member');

      const response = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/transfer-ownership`),
        owner,
      )
        .send({ userId: member.userId })
        .expect(200);

      expect(response.body).toMatchObject({ role: 'owner', status: 'active' });

      const asNewOwner = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}`),
        member.session,
      ).expect(200);
      expect(asNewOwner.body.role).toBe('owner');

      const asOldOwner = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}`),
        owner,
      ).expect(200);
      expect(asOldOwner.body.role).toBe('admin');
      expect(asOldOwner.body.workspace.ownerId).toBe(member.userId);

      await withAuth(http().delete(`/api/v1/workspaces/${workspace.id}`), owner).expect(403);
      await withAuth(http().delete(`/api/v1/workspaces/${workspace.id}`), member.session).expect(
        200,
      );
    });

    it('denies an admin and answers 404 for a non-member', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const admin = await addMember(workspace, owner, 'admin');
      const outsider = await createSession(ctx);

      await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/transfer-ownership`),
        admin.session,
      )
        .send({ userId: admin.userId })
        .expect(403);

      const response = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/transfer-ownership`),
        owner,
      )
        .send({ userId: outsider.credentials.email })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Invites', () => {
    it('runs the full flow with an existing account', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const guest = await createSession(ctx);

      const created = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/invites`),
        owner,
      )
        .send({ email: guest.credentials.email, role: 'member' })
        .expect(201);

      expect(created.body.invite).toMatchObject({
        email: guest.credentials.email,
        role: 'member',
      });
      expect(created.body.invite.tokenHash).toBeUndefined();
      expect(created.body.acceptUrl).toContain(created.body.token);

      const pending = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/invites`),
        owner,
      ).expect(200);
      expect(pending.body.items).toHaveLength(1);

      const members = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/members`),
        owner,
      ).expect(200);
      expect(members.body.items).toHaveLength(2);
      expect(members.body.items[1]).toMatchObject({ status: 'invited', role: 'member' });

      const accepted = await http()
        .post('/api/v1/invites/accept')
        .set('X-Forwarded-For', guest.credentials.ip)
        .send({ token: created.body.token })
        .expect(200);

      expect(accepted.body).toMatchObject({
        workspace: { id: workspace.id, slug: workspace.slug },
        accountCreated: false,
      });
      expect(accepted.body.member).toMatchObject({ role: 'member', status: 'active' });

      await withAuth(http().get(`/api/v1/workspaces/${workspace.id}`), guest).expect(200);

      const afterAccept = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/invites`),
        owner,
      ).expect(200);
      expect(afterAccept.body.items).toHaveLength(0);

      await http()
        .post('/api/v1/invites/accept')
        .set('X-Forwarded-For', guest.credentials.ip)
        .send({ token: created.body.token })
        .expect(409);
    });

    it('creates the account together with the acceptance', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const email = uniqueEmail();

      const created = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/invites`),
        owner,
      )
        .send({ email, role: 'admin' })
        .expect(201);

      const missingAccount = await http()
        .post('/api/v1/invites/accept')
        .send({ token: created.body.token })
        .expect(400);
      expect(missingAccount.body.code).toBe('ACCOUNT_REQUIRED');

      const accepted = await http()
        .post('/api/v1/invites/accept')
        .send({ token: created.body.token, name: 'Nova Pessoa', password: 'Azuos2026' })
        .expect(200);

      expect(accepted.body.accountCreated).toBe(true);
      expect(accepted.body.member.role).toBe('admin');

      const session = await login(ctx, { email, password: 'Azuos2026', ip: '10.9.9.9' }).expect(
        200,
      );

      await http()
        .get(`/api/v1/workspaces/${workspace.id}`)
        .set('Authorization', `Bearer ${session.body.accessToken}`)
        .set('X-Forwarded-For', '10.9.9.9')
        .expect(200);
    });

    it('cancels an invite and rejects the cancelled token', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const email = uniqueEmail();

      const created = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/invites`),
        owner,
      )
        .send({ email, role: 'guest' })
        .expect(201);

      await withAuth(
        http().delete(`/api/v1/workspaces/${workspace.id}/invites/${created.body.invite.id}`),
        owner,
      ).expect(200);

      const response = await http()
        .post('/api/v1/invites/accept')
        .send({ token: created.body.token, name: 'Nova Pessoa', password: 'Azuos2026' })
        .expect(404);

      expect(response.body.code).toBe('INVITE_NOT_FOUND');
    });

    it('denies a member creating invites and validates the payload', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const member = await addMember(workspace, owner, 'member');

      const forbidden = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/invites`),
        member.session,
      )
        .send({ email: uniqueEmail(), role: 'guest' })
        .expect(403);
      expect(forbidden.body.code).toBe('FORBIDDEN_ROLE');

      await withAuth(http().post(`/api/v1/workspaces/${workspace.id}/invites`), owner)
        .send({ email: 'sem-arroba', role: 'guest' })
        .expect(400);

      await withAuth(http().post(`/api/v1/workspaces/${workspace.id}/invites`), owner)
        .send({ email: uniqueEmail(), role: 'owner' })
        .expect(400);

      const duplicated = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/invites`),
        owner,
      )
        .send({ email: member.session.credentials.email, role: 'guest' })
        .expect(409);
      expect(duplicated.body.code).toBe('ALREADY_MEMBER');
    });
  });

  describe('Teams', () => {
    it('handles the full CRUD', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const member = await addMember(workspace, owner, 'member');

      const created = await withAuth(http().post(`/api/v1/workspaces/${workspace.id}/teams`), owner)
        .send({ name: 'Squad Produto', memberIds: [member.userId] })
        .expect(201);

      expect(created.body).toMatchObject({ name: 'Squad Produto' });
      expect(created.body.memberIds).toEqual([member.userId]);

      const list = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/teams`),
        owner,
      ).expect(200);
      expect(list.body.items).toHaveLength(1);
      expect(list.body.nextCursor).toBeNull();

      const updated = await withAuth(
        http().patch(`/api/v1/workspaces/${workspace.id}/teams/${created.body.id}`),
        owner,
      )
        .send({ name: 'Squad Plataforma', memberIds: [] })
        .expect(200);
      expect(updated.body).toMatchObject({ name: 'Squad Plataforma', memberIds: [] });

      await withAuth(
        http().delete(`/api/v1/workspaces/${workspace.id}/teams/${created.body.id}`),
        owner,
      ).expect(200);

      await withAuth(
        http().patch(`/api/v1/workspaces/${workspace.id}/teams/${created.body.id}`),
        owner,
      )
        .send({ name: 'Fantasma' })
        .expect(404);
    });

    it('denies a member and validates the composition', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const member = await addMember(workspace, owner, 'member');
      const outsider = await createSession(ctx);

      const forbidden = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/teams`),
        member.session,
      )
        .send({ name: 'Squad Produto' })
        .expect(403);
      expect(forbidden.body.code).toBe('FORBIDDEN_ROLE');

      await withAuth(http().post(`/api/v1/workspaces/${workspace.id}/teams`), owner)
        .send({ name: 'A' })
        .expect(400);

      const invalidMembers = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/teams`),
        owner,
      )
        .send({ name: 'Squad Produto', memberIds: [outsider.credentials.email] })
        .expect(400);
      expect(invalidMembers.body.code).toBe('VALIDATION_ERROR');

      const teams = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/teams`),
        member.session,
      ).expect(200);
      expect(teams.body.items).toHaveLength(0);
    });

    it('refuses members from outside the workspace', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const outsider = await createSession(ctx);
      const outsiderWorkspace = await createWorkspace(outsider, 'Outro Workspace');

      const outsiderMembers = await withAuth(
        http().get(`/api/v1/workspaces/${outsiderWorkspace.id}/members`),
        outsider,
      ).expect(200);
      const outsiderUserId = outsiderMembers.body.items[0].userId.id as string;

      const response = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/teams`),
        owner,
      )
        .send({ name: 'Squad Produto', memberIds: [outsiderUserId] })
        .expect(400);

      expect(response.body.code).toBe('INVALID_TEAM_MEMBERS');
    });
  });
});
