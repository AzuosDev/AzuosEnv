import request from 'supertest';
import { Session, createSession } from './utils/auth-client';
import { TestApp, createTestApp } from './utils/e2e-app';

interface WorkspaceBody {
  id: string;
}

interface SpaceBody {
  id: string;
}

interface DocBody {
  id: string;
  title: string;
  locationType: string;
  locationId: string | null;
  private: boolean;
  isWiki: boolean;
  icon: string | null;
  share: { public: boolean; tokenHash?: string };
  createdBy: string;
  archivedAt: string | null;
}

interface PageBody {
  id: string;
  docId: string;
  parentPageId: string | null;
  title: string;
  content: Record<string, unknown> | null;
  contentText: string;
  mentionedTaskIds: string[];
  position: string;
  version: number;
  updatedBy: string;
}

interface PageVersionBody {
  id: string;
  pageId: string;
  version: number;
  title: string;
  contentText: string;
}

interface MemberFixture {
  session: Session;
  userId: string;
}

describe('Docs com páginas aninhadas', () => {
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

  function createDoc(
    workspace: WorkspaceBody,
    session: Session,
    body: Record<string, unknown>,
  ): request.Test {
    return withAuth(http().post(`/api/v1/workspaces/${workspace.id}/docs`), session).send(body);
  }

  async function createdDoc(
    workspace: WorkspaceBody,
    session: Session,
    body: Record<string, unknown> = {},
  ): Promise<DocBody> {
    const response = await createDoc(workspace, session, {
      locationType: 'workspace',
      title: 'Guia de deploy',
      ...body,
    }).expect(201);

    return response.body as DocBody;
  }

  async function createdPage(
    workspace: WorkspaceBody,
    session: Session,
    doc: DocBody,
    body: Record<string, unknown> = {},
  ): Promise<PageBody> {
    const response = await withAuth(
      http().post(`/api/v1/workspaces/${workspace.id}/docs/${doc.id}/pages`),
      session,
    )
      .send({ title: 'Passo a passo', ...body })
      .expect(201);

    return response.body as PageBody;
  }

  function patchPage(
    workspace: WorkspaceBody,
    session: Session,
    page: PageBody,
    body: Record<string, unknown>,
  ): request.Test {
    return withAuth(
      http().patch(`/api/v1/workspaces/${workspace.id}/pages/${page.id}`),
      session,
    ).send(body);
  }

  describe('Docs', () => {
    it('cria um Doc no local e o expõe como view de tipo doc', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const space = await createSpace(workspace, owner);
      const doc = await createdDoc(workspace, owner, {
        locationType: 'space',
        locationId: space.id,
        title: 'Wiki do cliente',
        icon: 'book',
        isWiki: true,
      });

      expect(doc.locationId).toBe(space.id);
      expect(doc.isWiki).toBe(true);
      expect(doc.share.public).toBe(false);
      expect(doc.share.tokenHash).toBeUndefined();

      const views = await withAuth(
        http().get(
          `/api/v1/workspaces/${workspace.id}/views?locationType=space&locationId=${space.id}`,
        ),
        owner,
      ).expect(200);
      const docView = (
        views.body.items as { type: string; name: string; config: Record<string, unknown> }[]
      ).find((view) => view.type === 'doc');

      expect(docView?.name).toBe('Wiki do cliente');
      expect(docView?.config).toEqual({ options: { docId: doc.id } });
    });

    it('recusa Doc sem título e sem local', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);

      await createDoc(workspace, owner, { locationType: 'workspace' }).expect(400);

      const missingLocation = await createDoc(workspace, owner, {
        locationType: 'space',
        title: 'Sem local',
      }).expect(400);

      expect(missingLocation.body.code).toBe('INVALID_DOC_LOCATION');
    });

    it('esconde o Doc privado de quem não é o autor', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const admin = await addMember(workspace, owner, 'admin');
      const doc = await createdDoc(workspace, owner, { title: 'Rascunho', private: true });

      const mine = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/docs?tab=all`),
        owner,
      ).expect(200);

      expect((mine.body.items as DocBody[]).map((item) => item.id)).toContain(doc.id);

      const hidden = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/docs/${doc.id}`),
        admin.session,
      ).expect(404);

      expect(hidden.body.code).toBe('DOC_NOT_FOUND');

      const list = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/docs?tab=all`),
        admin.session,
      ).expect(200);

      expect((list.body.items as DocBody[]).map((item) => item.id)).not.toContain(doc.id);
    });

    it('nega o Doc a quem não tem permissão no local', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const guest = await addMember(workspace, owner, 'guest');
      const space = await createSpace(workspace, owner, { private: true });
      const doc = await createdDoc(workspace, owner, {
        locationType: 'space',
        locationId: space.id,
        title: 'Interno',
      });

      const denied = await createDoc(workspace, guest.session, {
        locationType: 'workspace',
        title: 'Do convidado',
      }).expect(404);

      expect(denied.body.code).toBe('DOC_NOT_FOUND');

      await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/docs/${doc.id}`),
        guest.session,
      ).expect(404);
    });

    it('lista as abas do hub', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const member = await addMember(workspace, owner, 'member');
      const mine = await createdDoc(workspace, owner, { title: 'Meu doc' });
      const other = await createdDoc(workspace, member.session, { title: 'Doc do time' });

      const minha = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/docs?tab=mine`),
        owner,
      ).expect(200);

      expect((minha.body.items as DocBody[]).map((item) => item.id)).toEqual([mine.id]);

      await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/docs/${other.id}`),
        owner,
      ).expect(200);

      const recent = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/docs?tab=recent`),
        owner,
      ).expect(200);

      expect((recent.body.items as DocBody[]).map((item) => item.id)).toEqual([other.id]);

      await withAuth(http().post(`/api/v1/workspaces/${workspace.id}/favorites`), owner)
        .send({ entityType: 'doc', entityId: mine.id })
        .expect(201);

      const favorites = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/docs?tab=favorites`),
        owner,
      ).expect(200);

      expect((favorites.body.items as DocBody[]).map((item) => item.id)).toEqual([mine.id]);
    });

    it('manda o Doc para a lixeira e restaura com a view', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const space = await createSpace(workspace, owner);
      const doc = await createdDoc(workspace, owner, {
        locationType: 'space',
        locationId: space.id,
        title: 'Temporário',
      });

      await withAuth(
        http().delete(`/api/v1/workspaces/${workspace.id}/docs/${doc.id}`),
        owner,
      ).expect(200);

      await withAuth(http().get(`/api/v1/workspaces/${workspace.id}/docs/${doc.id}`), owner).expect(
        404,
      );

      const restored = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/docs/${doc.id}/restore`),
        owner,
      ).expect(200);

      expect((restored.body as DocBody).id).toBe(doc.id);

      const views = await withAuth(
        http().get(
          `/api/v1/workspaces/${workspace.id}/views?locationType=space&locationId=${space.id}`,
        ),
        owner,
      ).expect(200);

      expect(
        (views.body.items as { type: string }[]).filter((view) => view.type === 'doc'),
      ).toHaveLength(1);
    });
  });

  describe('Páginas', () => {
    it('cria página aninhada e lista a árvore do Doc', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const doc = await createdDoc(workspace, owner);
      const root = await createdPage(workspace, owner, doc, { title: 'Introdução' });
      const child = await createdPage(workspace, owner, doc, {
        title: 'Detalhes',
        parentPageId: root.id,
        contentText: 'conteúdo da página aninhada',
      });

      expect(root.parentPageId).toBeNull();
      expect(root.version).toBe(1);
      expect(child.parentPageId).toBe(root.id);

      const tree = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/docs/${doc.id}/pages`),
        owner,
      ).expect(200);
      const items = tree.body.items as PageBody[];

      expect(items).toHaveLength(2);
      expect(items.map((item) => item.title)).toEqual(['Introdução', 'Detalhes']);

      const moved = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/pages/${child.id}/move`),
        owner,
      )
        .send({ parentPageId: null })
        .expect(200);

      expect((moved.body as PageBody).parentPageId).toBeNull();
    });

    it('recusa página pai de outro Doc e PATCH sem versão', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const doc = await createdDoc(workspace, owner);
      const other = await createdDoc(workspace, owner, { title: 'Outro doc' });
      const page = await createdPage(workspace, owner, doc);

      const invalid = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/docs/${other.id}/pages`),
        owner,
      )
        .send({ title: 'Órfã', parentPageId: page.id })
        .expect(400);

      expect(invalid.body.code).toBe('INVALID_PAGE_PARENT');

      await patchPage(workspace, owner, page, { contentText: 'sem versão' }).expect(400);
    });

    it('salva com controle de versão e responde 409 na divergência', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const doc = await createdDoc(workspace, owner);
      const page = await createdPage(workspace, owner, doc);

      const saved = await patchPage(workspace, owner, page, {
        version: page.version,
        contentText: 'primeira versão',
        content: { type: 'doc', content: [] },
      }).expect(200);

      expect((saved.body as PageBody).version).toBe(2);
      expect((saved.body as PageBody).contentText).toBe('primeira versão');

      const conflict = await patchPage(workspace, owner, page, {
        version: page.version,
        contentText: 'escrita concorrente',
      }).expect(409);

      expect(conflict.body.code).toBe('PAGE_VERSION_CONFLICT');
    });

    it('lista e restaura uma versão da página', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const doc = await createdDoc(workspace, owner);
      const page = await createdPage(workspace, owner, doc, { contentText: 'texto original' });

      const second = await patchPage(workspace, owner, page, {
        version: page.version,
        contentText: 'texto novo',
      }).expect(200);

      const versions = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/pages/${page.id}/versions`),
        owner,
      ).expect(200);
      const items = versions.body.items as PageVersionBody[];

      expect(items).toHaveLength(1);
      expect(items[0].contentText).toBe('texto original');

      const restored = await withAuth(
        http().post(
          `/api/v1/workspaces/${workspace.id}/pages/${page.id}/versions/${items[0].id}/restore`,
        ),
        owner,
      ).expect(200);

      expect((restored.body as PageBody).contentText).toBe('texto original');
      expect((restored.body as PageBody).version).toBe((second.body as PageBody).version + 1);
    });

    it('nega a página de um Doc invisível', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const member = await addMember(workspace, owner, 'member');
      const doc = await createdDoc(workspace, owner, { title: 'Privado', private: true });
      const page = await createdPage(workspace, owner, doc);

      const denied = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/pages/${page.id}`),
        member.session,
      ).expect(404);

      expect(denied.body.code).toBe('PAGE_NOT_FOUND');
    });

    it('comenta na página reaproveitando comments', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const doc = await createdDoc(workspace, owner);
      const page = await createdPage(workspace, owner, doc);

      const comment = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/pages/${page.id}/comments`),
        owner,
      )
        .send({ bodyText: 'revisar este trecho', anchor: 'parágrafo 2' })
        .expect(201);

      expect(comment.body.entityType).toBe('page');
      expect(comment.body.entityId).toBe(page.id);
      expect(comment.body.anchor).toBe('parágrafo 2');

      await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/pages/${page.id}/comments`),
        owner,
      )
        .send({ bodyText: 'feito', parentCommentId: comment.body.id })
        .expect(201);

      await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/pages/${page.id}/comments`),
        owner,
      )
        .send({ anchor: 'sem corpo' })
        .expect(400);

      const list = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/pages/${page.id}/comments`),
        owner,
      ).expect(200);

      expect(list.body.items).toHaveLength(1);
      expect(list.body.items[0].comment.bodyText).toBe('revisar este trecho');
      expect(list.body.items[0].replies).toHaveLength(1);
    });
  });

  describe('Compartilhamento público', () => {
    it('lê pelo link público e não edita', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const doc = await createdDoc(workspace, owner, { title: 'Manual público' });
      const page = await createdPage(workspace, owner, doc, { contentText: 'passo 1' });

      const shared = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/docs/${doc.id}/share`),
        owner,
      )
        .send({ public: true })
        .expect(200);

      const token = shared.body.token as string;

      expect(token).toHaveLength(43);
      expect(shared.body.doc.share.public).toBe(true);
      expect(shared.body.doc.share.tokenHash).toBeUndefined();

      const read = await http().get(`/api/v1/public/docs/${token}`).expect(200);

      expect(read.body.doc.title).toBe('Manual público');
      expect(read.body.pages).toHaveLength(1);
      expect(read.body.pages[0].contentText).toBe('passo 1');

      await http()
        .patch(`/api/v1/workspaces/${workspace.id}/pages/${page.id}`)
        .send({ version: page.version, contentText: 'alterado sem sessão' })
        .expect(401);

      await http().patch(`/api/v1/public/docs/${token}`).send({ title: 'novo' }).expect(404);
      await http().get('/api/v1/public/docs/token-invalido').expect(404);

      await withAuth(http().post(`/api/v1/workspaces/${workspace.id}/docs/${doc.id}/share`), owner)
        .send({ public: false })
        .expect(200);

      await http().get(`/api/v1/public/docs/${token}`).expect(404);
    });

    it('só quem administra o Doc cria o link', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const space = await createSpace(workspace, owner, { private: true });
      const guest = await addMember(workspace, owner, 'guest');
      const doc = await createdDoc(workspace, owner, {
        locationType: 'space',
        locationId: space.id,
        title: 'Restrito',
      });

      await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/docs/${doc.id}/share`),
        guest.session,
      )
        .send({ public: true })
        .expect(404);
    });
  });

  describe('Busca', () => {
    it('inclui as páginas dos Docs visíveis', async () => {
      const owner = await createSession(ctx);
      const workspace = await createWorkspace(owner);
      const member = await addMember(workspace, owner, 'member');
      const doc = await createdDoc(workspace, owner, { title: 'Base de conhecimento' });
      const page = await createdPage(workspace, owner, doc, {
        title: 'Rotina de backup',
        contentText: 'executar o backup do banco toda madrugada',
      });
      const secret = await createdDoc(workspace, owner, { title: 'Sigiloso', private: true });

      await createdPage(workspace, owner, secret, {
        title: 'Backup secreto',
        contentText: 'backup do cofre',
      });

      const found = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/search?q=backup&types=page`),
        owner,
      ).expect(200);

      expect((found.body.results.page as { id: string }[]).map((hit) => hit.id)).toContain(page.id);

      const limited = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/search?q=backup&types=page`),
        member.session,
      ).expect(200);
      const ids = (limited.body.results.page as { id: string }[]).map((hit) => hit.id);

      expect(ids).toContain(page.id);
      expect(ids).toHaveLength(1);
    });
  });
});
