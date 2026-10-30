import request from 'supertest';
import { Session, createSession } from './utils/auth-client';
import { TestApp, createTestApp } from './utils/e2e-app';

interface WorkspaceBody {
  id: string;
  taskPrefix: string;
}

interface SpaceBody {
  id: string;
}

interface ListBody {
  id: string;
}

interface FieldBody {
  id: string;
  name: string;
  scope: string;
  scopeId: string;
  type: string;
  required: boolean;
  position: string;
  config: { options?: { id: string; name: string }[]; currency?: string; expression?: string };
}

interface TaskBody {
  id: string;
  customId: string;
  name: string;
  customFields: { fieldId: string; value: unknown }[];
}

interface ViewBody {
  id: string;
  name: string;
  type: string;
  locationType: string;
  locationId: string | null;
  ownerId: string;
  private: boolean;
  protected: boolean;
  isDefault: boolean;
  pinned: boolean;
  position: string;
  config: Record<string, unknown>;
}

interface ViewPage {
  items: ViewBody[];
  nextCursor: string | null;
}

interface MemberFixture {
  session: Session;
  userId: string;
}

describe('Campos personalizados, views e exportação', () => {
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

  async function createSpace(workspace: WorkspaceBody, session: Session): Promise<SpaceBody> {
    const response = await withAuth(
      http().post(`/api/v1/workspaces/${workspace.id}/spaces`),
      session,
    )
      .send({ name: 'Clientes' })
      .expect(201);

    return response.body as SpaceBody;
  }

  async function createList(
    workspace: WorkspaceBody,
    session: Session,
    space: SpaceBody,
  ): Promise<ListBody> {
    const response = await withAuth(
      http().post(`/api/v1/workspaces/${workspace.id}/lists`),
      session,
    )
      .send({ spaceId: space.id, name: 'uSolutionsPDV — Sprint 3' })
      .expect(201);

    return response.body as ListBody;
  }

  function createField(
    workspace: WorkspaceBody,
    session: Session,
    body: Record<string, unknown>,
  ): request.Test {
    return withAuth(http().post(`/api/v1/workspaces/${workspace.id}/custom-fields`), session).send(
      body,
    );
  }

  async function createdField(
    workspace: WorkspaceBody,
    session: Session,
    space: SpaceBody,
    body: Record<string, unknown>,
  ): Promise<FieldBody> {
    const response = await createField(workspace, session, {
      scope: 'space',
      scopeId: space.id,
      ...body,
    }).expect(201);

    return response.body as FieldBody;
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

  async function taskDetail(
    workspace: WorkspaceBody,
    session: Session,
    task: TaskBody,
  ): Promise<TaskBody> {
    const response = await withAuth(
      http().get(`/api/v1/workspaces/${workspace.id}/tasks/${task.id}`),
      session,
    ).expect(200);

    return response.body as TaskBody;
  }

  function createView(
    workspace: WorkspaceBody,
    session: Session,
    body: Record<string, unknown>,
  ): request.Test {
    return withAuth(http().post(`/api/v1/workspaces/${workspace.id}/views`), session).send(body);
  }

  async function createdView(
    workspace: WorkspaceBody,
    session: Session,
    list: ListBody,
    body: Record<string, unknown> = {},
  ): Promise<ViewBody> {
    const response = await createView(workspace, session, {
      locationType: 'list',
      locationId: list.id,
      type: 'table',
      name: 'Sprint atual',
      ...body,
    }).expect(201);

    return response.body as ViewBody;
  }

  async function listViews(
    workspace: WorkspaceBody,
    session: Session,
    query: Record<string, unknown> = {},
  ): Promise<ViewPage> {
    const response = await withAuth(http().get(`/api/v1/workspaces/${workspace.id}/views`), session)
      .query(query)
      .expect(200);

    return response.body as ViewPage;
  }

  interface Fixture {
    owner: Session;
    workspace: WorkspaceBody;
    space: SpaceBody;
    list: ListBody;
  }

  async function setup(): Promise<Fixture> {
    const owner = await createSession(ctx);
    const workspace = await createWorkspace(owner);
    const space = await createSpace(workspace, owner);

    return { owner, workspace, space, list: await createList(workspace, owner, space) };
  }

  const TYPE_OPTIONS = [
    { id: 'feature', name: 'Feature' },
    { id: 'bug', name: 'Bug' },
  ];

  describe('campos personalizados', () => {
    it('cria no Space e a List herda o campo', async () => {
      const { owner, workspace, space, list } = await setup();

      const field = await createdField(workspace, owner, space, {
        name: 'Tipo',
        type: 'dropdown',
        config: { options: TYPE_OPTIONS },
      });

      expect(field.config.options?.map((option) => option.id)).toEqual(['feature', 'bug']);

      const response = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/custom-fields`),
        owner,
      )
        .query({ scope: 'list', scopeId: list.id })
        .expect(200);

      expect((response.body as FieldBody[]).map((item) => item.id)).toEqual([field.id]);
    });

    it('valida o valor por tipo', async () => {
      const { owner, workspace, space, list } = await setup();
      const tipo = await createdField(workspace, owner, space, {
        name: 'Tipo',
        type: 'dropdown',
        config: { options: TYPE_OPTIONS },
      });
      const valor = await createdField(workspace, owner, space, {
        name: 'Valor',
        type: 'currency',
        config: { currency: 'BRL', precision: 2 },
      });
      const faturavel = await createdField(workspace, owner, space, {
        name: 'Faturável',
        type: 'checkbox',
      });

      const invalid = await createTask(workspace, owner, list, {
        customFields: [{ fieldId: tipo.id, value: 'melhoria' }],
      }).expect(400);

      expect(invalid.body.code).toBe('INVALID_CUSTOM_FIELD_VALUE');

      await createTask(workspace, owner, list, {
        customFields: [{ fieldId: faturavel.id, value: 'sim' }],
      }).expect(400);

      const task = await createdTask(workspace, owner, list, {
        customFields: [
          { fieldId: tipo.id, value: 'bug' },
          { fieldId: valor.id, value: 1200.456 },
          { fieldId: faturavel.id, value: true },
        ],
      });

      const values = new Map(task.customFields.map((item) => [item.fieldId, item.value]));

      expect(values.get(tipo.id)).toBe('bug');
      expect(values.get(valor.id)).toBe(1200.46);
      expect(values.get(faturavel.id)).toBe(true);
    });

    it('recusa campo de outra List, exige o obrigatório e limpa com null', async () => {
      const { owner, workspace, space, list } = await setup();
      const other = await createSpace(workspace, owner);
      const outside = await createdField(workspace, owner, other, {
        name: 'Versão',
        type: 'text',
      });
      const versao = await createdField(workspace, owner, space, {
        name: 'Versão',
        type: 'text',
        required: true,
      });

      const unavailable = await createTask(workspace, owner, list, {
        customFields: [
          { fieldId: versao.id, value: '3.2' },
          { fieldId: outside.id, value: '3.2' },
        ],
      }).expect(400);

      expect(unavailable.body.code).toBe('INVALID_CUSTOM_FIELD');

      const missing = await createTask(workspace, owner, list).expect(400);

      expect(missing.body.code).toBe('CUSTOM_FIELD_REQUIRED');

      const task = await createdTask(workspace, owner, list, {
        customFields: [{ fieldId: versao.id, value: '3.2' }],
      });

      const cleared = await withAuth(
        http().patch(`/api/v1/workspaces/${workspace.id}/tasks/${task.id}`),
        owner,
      )
        .send({ customFields: [{ fieldId: versao.id, value: null }] })
        .expect(400);

      expect(cleared.body.code).toBe('CUSTOM_FIELD_REQUIRED');
    });

    it('calcula a fórmula na leitura e não aceita valor gravado', async () => {
      const { owner, workspace, space, list } = await setup();
      const horas = await createdField(workspace, owner, space, { name: 'Horas', type: 'number' });
      const valorHora = await createdField(workspace, owner, space, {
        name: 'Valor hora',
        type: 'number',
      });
      const total = await createdField(workspace, owner, space, {
        name: 'Total',
        type: 'formula',
        config: { expression: '{Horas} * {Valor hora}' },
      });

      const task = await createdTask(workspace, owner, list, {
        customFields: [
          { fieldId: horas.id, value: 10 },
          { fieldId: valorHora.id, value: 2.5 },
        ],
      });

      const detail = await taskDetail(workspace, owner, task);
      const values = new Map(detail.customFields.map((item) => [item.fieldId, item.value]));

      expect(values.get(total.id)).toBe(25);

      const invalid = await withAuth(
        http().patch(`/api/v1/workspaces/${workspace.id}/tasks/${task.id}`),
        owner,
      )
        .send({ customFields: [{ fieldId: total.id, value: 99 }] })
        .expect(400);

      expect(invalid.body.code).toBe('INVALID_CUSTOM_FIELD_VALUE');
    });

    it('valida a configuração do campo', async () => {
      const { owner, workspace, space } = await setup();

      const withoutOptions = await createField(workspace, owner, {
        scope: 'space',
        scopeId: space.id,
        name: 'Tipo',
        type: 'dropdown',
      }).expect(400);

      expect(withoutOptions.body.code).toBe('INVALID_CUSTOM_FIELD');

      const badFormula = await createField(workspace, owner, {
        scope: 'space',
        scopeId: space.id,
        name: 'Total',
        type: 'formula',
        config: { expression: '{Horas} *' },
      }).expect(400);

      expect(badFormula.body.code).toBe('INVALID_FORMULA');
    });

    it('esconde o campo de quem não vê o Space e exclui com os valores', async () => {
      const { owner, workspace, space, list } = await setup();
      const guest = await addMember(workspace, owner, 'guest');
      const field = await createdField(workspace, owner, space, {
        name: 'Tipo',
        type: 'dropdown',
        config: { options: TYPE_OPTIONS },
      });

      const denied = await createField(workspace, guest.session, {
        scope: 'space',
        scopeId: space.id,
        name: 'Ambiente',
        type: 'text',
      }).expect(404);

      expect(denied.body.code).toBe('SPACE_NOT_FOUND');

      await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/custom-fields/${field.id}`),
        guest.session,
      ).expect(404);

      const task = await createdTask(workspace, owner, list, {
        customFields: [{ fieldId: field.id, value: 'bug' }],
      });

      await withAuth(
        http().delete(`/api/v1/workspaces/${workspace.id}/custom-fields/${field.id}`),
        owner,
      ).expect(200);

      expect((await taskDetail(workspace, owner, task)).customFields).toEqual([]);
    });
  });

  describe('consulta por campo', () => {
    it('filtra por dropdown e ordena pelo campo', async () => {
      const { owner, workspace, space, list } = await setup();
      const tipo = await createdField(workspace, owner, space, {
        name: 'Tipo',
        type: 'dropdown',
        config: { options: TYPE_OPTIONS },
      });
      const valor = await createdField(workspace, owner, space, {
        name: 'Valor',
        type: 'currency',
      });

      const bug = await createdTask(workspace, owner, list, {
        name: 'Bug do caixa',
        customFields: [
          { fieldId: tipo.id, value: 'bug' },
          { fieldId: valor.id, value: 900 },
        ],
      });
      const feature = await createdTask(workspace, owner, list, {
        name: 'Relatório novo',
        customFields: [
          { fieldId: tipo.id, value: 'feature' },
          { fieldId: valor.id, value: 300 },
        ],
      });
      await createdTask(workspace, owner, list, { name: 'Sem tipo' });

      const filtered = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/tasks/query`),
        owner,
      )
        .query({
          fieldFilters: JSON.stringify([{ fieldId: tipo.id, op: 'eq', value: 'bug' }]),
        })
        .expect(200);

      expect((filtered.body.items as TaskBody[]).map((item) => item.id)).toEqual([bug.id]);

      const empty = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/tasks/query`),
        owner,
      )
        .query({ fieldFilters: JSON.stringify([{ fieldId: tipo.id, op: 'isEmpty' }]) })
        .expect(200);

      expect((empty.body.items as TaskBody[]).map((item) => item.name)).toEqual(['Sem tipo']);

      const sorted = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/tasks/query`),
        owner,
      )
        .query({ sortBy: 'field', sortFieldId: valor.id })
        .expect(200);

      expect((sorted.body.items as TaskBody[]).slice(0, 2).map((item) => item.id)).toEqual([
        feature.id,
        bug.id,
      ]);

      const invalid = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/tasks/query`),
        owner,
      )
        .query({ fieldFilters: '{' })
        .expect(400);

      expect(invalid.body.code).toBe('INVALID_FIELD_FILTER');
    });
  });

  describe('views', () => {
    it('cria as views List e Board com o Space, o Folder e a List', async () => {
      const { owner, workspace, space, list } = await setup();

      const ofList = await listViews(workspace, owner, {
        locationType: 'list',
        locationId: list.id,
      });

      expect(ofList.items.map((view) => view.type)).toEqual(['list', 'board']);
      expect(ofList.items.map((view) => view.isDefault)).toEqual([true, false]);

      const ofSpace = await listViews(workspace, owner, {
        locationType: 'space',
        locationId: space.id,
      });

      expect(ofSpace.items.map((view) => view.name)).toEqual(['List', 'Board']);
    });

    it('cria, atualiza, duplica, reordena e exclui', async () => {
      const { owner, workspace, list } = await setup();

      const view = await createdView(workspace, owner, list, {
        config: {
          filters: { priority: ['urgent'] },
          groupBy: 'status',
          sortBy: 'dueAt',
          columns: [{ key: 'name', width: 320 }],
          showClosed: true,
        },
        pinned: true,
      });

      expect(view.config.groupBy).toBe('status');
      expect(view.pinned).toBe(true);
      expect(view.ownerId).toBeDefined();

      const updated = await withAuth(
        http().patch(`/api/v1/workspaces/${workspace.id}/views/${view.id}`),
        owner,
      )
        .send({ name: 'Sprint 3', isDefault: true })
        .expect(200);

      expect((updated.body as ViewBody).name).toBe('Sprint 3');

      const defaults = await listViews(workspace, owner, {
        locationType: 'list',
        locationId: list.id,
      });

      expect(defaults.items.filter((item) => item.isDefault).map((item) => item.id)).toEqual([
        view.id,
      ]);

      const duplicate = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/views/${view.id}/duplicate`),
        owner,
      ).expect(201);

      expect((duplicate.body as ViewBody).name).toBe('Sprint 3 (cópia)');
      expect((duplicate.body as ViewBody).isDefault).toBe(false);

      await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/views/${view.id}/reorder`),
        owner,
      )
        .send({ nextId: defaults.items[0].id })
        .expect(200);

      const reordered = await listViews(workspace, owner, {
        locationType: 'list',
        locationId: list.id,
      });

      expect(reordered.items[0].id).toBe(view.id);

      await withAuth(
        http().delete(`/api/v1/workspaces/${workspace.id}/views/${view.id}`),
        owner,
      ).expect(200);

      await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/views/${view.id}`),
        owner,
      ).expect(404);
    });

    it('exige a localização da view', async () => {
      const { owner, workspace } = await setup();

      const response = await createView(workspace, owner, {
        locationType: 'list',
        type: 'list',
        name: 'Sem local',
      }).expect(400);

      expect(response.body.code).toBe('INVALID_VIEW_LOCATION');
    });

    it('deixa a view privada invisível para os outros', async () => {
      const { owner, workspace, list } = await setup();
      const member = await addMember(workspace, owner, 'member');

      const view = await createdView(workspace, owner, list, {
        name: 'Minha triagem',
        private: true,
      });

      const denied = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/views/${view.id}`),
        member.session,
      ).expect(404);

      expect(denied.body.code).toBe('VIEW_NOT_FOUND');

      const visible = await listViews(workspace, member.session, {
        locationType: 'list',
        locationId: list.id,
      });

      expect(visible.items.map((item) => item.id)).not.toContain(view.id);
      expect(
        (
          await listViews(workspace, owner, { locationType: 'list', locationId: list.id })
        ).items.map((item) => item.id),
      ).toContain(view.id);
    });

    it('deixa só o dono editar a view protegida', async () => {
      const { owner, workspace, list } = await setup();
      const member = await addMember(workspace, owner, 'member');

      const view = await createdView(workspace, member.session, list, {
        name: 'Planejamento',
        protected: true,
      });

      const denied = await withAuth(
        http().patch(`/api/v1/workspaces/${workspace.id}/views/${view.id}`),
        owner,
      )
        .send({ name: 'Outro nome' })
        .expect(403);

      expect(denied.body.code).toBe('FORBIDDEN_VIEW');

      await withAuth(
        http().patch(`/api/v1/workspaces/${workspace.id}/views/${view.id}`),
        member.session,
      )
        .send({ name: 'Planejamento 2026' })
        .expect(200);
    });

    it('esconde a view de quem não vê a List', async () => {
      const { owner, workspace, list } = await setup();
      const guest = await addMember(workspace, owner, 'guest');
      const view = await createdView(workspace, owner, list);

      await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/views/${view.id}`),
        guest.session,
      ).expect(404);

      expect((await listViews(workspace, guest.session)).items).toEqual([]);
    });
  });

  describe('exportação', () => {
    it('exporta a view em csv e em xlsx', async () => {
      const { owner, workspace, space, list } = await setup();
      const tipo = await createdField(workspace, owner, space, {
        name: 'Tipo',
        type: 'dropdown',
        config: { options: TYPE_OPTIONS },
      });

      const task = await createdTask(workspace, owner, list, {
        name: 'Bug do caixa',
        customFields: [{ fieldId: tipo.id, value: 'bug' }],
      });
      await createdTask(workspace, owner, list, { name: 'Relatório novo' });

      const view = await createdView(workspace, owner, list, {
        name: 'Tabela da sprint',
        config: {
          filters: { fieldFilters: [{ fieldId: tipo.id, op: 'eq', value: 'bug' }] },
          columns: [{ key: 'customId' }, { key: 'name' }, { key: `field:${tipo.id}` }],
        },
      });

      const csv = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/views/${view.id}/export`),
        owner,
      )
        .query({ format: 'csv' })
        .expect(200);

      expect(csv.headers['content-type']).toContain('text/csv');
      expect(csv.headers['content-disposition']).toContain('tabela-da-sprint.csv');
      expect(csv.text).toContain('"ID","Tarefa","Tipo"');
      expect(csv.text).toContain(`"${task.customId}","Bug do caixa","Bug"`);
      expect(csv.text).not.toContain('Relatório novo');

      const xlsx = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/views/${view.id}/export`),
        owner,
      )
        .query({ format: 'xlsx' })
        .responseType('blob')
        .expect(200);

      const body = xlsx.body as Buffer;

      expect(xlsx.headers['content-type']).toContain('spreadsheetml');
      expect(body.length).toBeGreaterThan(1000);
      expect(body.subarray(0, 2).toString('utf8')).toBe('PK');
    });

    it('não exporta a view que o usuário não vê', async () => {
      const { owner, workspace, list } = await setup();
      const guest = await addMember(workspace, owner, 'guest');
      const view = await createdView(workspace, owner, list);

      await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/views/${view.id}/export`),
        guest.session,
      ).expect(404);
    });
  });
});
