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
  group: 'notStarted' | 'active' | 'done' | 'closed';
}

interface TaskBody {
  id: string;
  customId: string;
  name: string;
  statusId: string;
}

interface ChecklistItemBody {
  id: string;
  text: string;
  done: boolean;
  assigneeId: string | null;
  position: string;
  parentItemId: string | null;
}

interface ChecklistBody {
  id: string;
  name: string;
  position: string;
  items: ChecklistItemBody[];
}

interface CommentBody {
  id: string;
  parentCommentId: string | null;
  bodyText: string;
  mentions: string[];
  assigneeId: string | null;
  resolvedAt: string | null;
  reactions: { emoji: string; userIds: string[] }[];
  editedAt: string | null;
}

interface ThreadBody {
  comment: CommentBody;
  replies: CommentBody[];
}

interface AttachmentBody {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  entityType: 'task' | 'comment';
  entityId: string;
  storageKey?: string;
}

interface DependencyBody {
  id: string;
  taskId: string;
  dependsOnId: string;
  type: 'waiting_on' | 'blocking' | 'linked';
}

interface ActivityBody {
  id: string;
  entityType: 'task' | 'comment';
  entityId: string;
  action: string;
  actorId: string;
  changes: { field: string; from: unknown; to: unknown }[];
}

interface MemberFixture {
  session: Session;
  userId: string;
}

/** Valid ObjectId that belongs to nobody in the workspace. */
const FOREIGN_USER_ID = '0123456789abcdef01234567';

interface Fixture {
  owner: Session;
  workspace: WorkspaceBody;
  space: SpaceBody;
  list: ListBody;
  statuses: StatusBody[];
  task: TaskBody;
}

describe('Colaboração na tarefa', () => {
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

  function share(
    workspace: WorkspaceBody,
    owner: Session,
    resourceId: string,
    principalId: string,
    level: 'view' | 'comment' | 'edit' | 'full',
  ): request.Test {
    return withAuth(http().post(`/api/v1/workspaces/${workspace.id}/permissions`), owner).send({
      resourceType: 'list',
      resourceId,
      principalType: 'user',
      principalId,
      level,
    });
  }

  async function setup(): Promise<Fixture> {
    const owner = await createSession(ctx);
    const workspace = await createWorkspace(owner);
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
    const statuses = (
      await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/lists/${list.id}/statuses`),
        owner,
      ).expect(200)
    ).body.statuses as StatusBody[];
    const task = await createTask(workspace, owner, list);

    return { owner, workspace, space, list, statuses, task };
  }

  async function createTask(
    workspace: WorkspaceBody,
    session: Session,
    list: ListBody,
    name = 'Corrigir fechamento de caixa',
  ): Promise<TaskBody> {
    const response = await withAuth(
      http().post(`/api/v1/workspaces/${workspace.id}/lists/${list.id}/tasks`),
      session,
    )
      .send({ name })
      .expect(201);

    return response.body as TaskBody;
  }

  function taskUrl(workspace: WorkspaceBody, task: TaskBody, suffix = ''): string {
    return `/api/v1/workspaces/${workspace.id}/tasks/${task.id}${suffix}`;
  }

  async function createChecklist(
    workspace: WorkspaceBody,
    session: Session,
    task: TaskBody,
    name = 'Critérios de aceite',
  ): Promise<ChecklistBody> {
    const response = await withAuth(http().post(taskUrl(workspace, task, '/checklists')), session)
      .send({ name })
      .expect(201);

    return response.body as ChecklistBody;
  }

  async function addItem(
    workspace: WorkspaceBody,
    session: Session,
    checklist: ChecklistBody,
    body: Record<string, unknown>,
  ): Promise<ChecklistBody> {
    const response = await withAuth(
      http().post(`/api/v1/workspaces/${workspace.id}/checklists/${checklist.id}/items`),
      session,
    )
      .send(body)
      .expect(201);

    return response.body as ChecklistBody;
  }

  function commentOn(
    workspace: WorkspaceBody,
    session: Session,
    task: TaskBody,
    body: Record<string, unknown>,
  ): request.Test {
    return withAuth(http().post(taskUrl(workspace, task, '/comments')), session).send(body);
  }

  async function createComment(
    workspace: WorkspaceBody,
    session: Session,
    task: TaskBody,
    body: Record<string, unknown> = { bodyText: 'Primeiro comentário' },
  ): Promise<CommentBody> {
    const response = await commentOn(workspace, session, task, body).expect(201);

    return response.body as CommentBody;
  }

  function uploadToTask(
    workspace: WorkspaceBody,
    session: Session,
    task: TaskBody,
    content = 'relatorio',
    filename = 'relatorio.txt',
    mimeType = 'text/plain',
  ): request.Test {
    return withAuth(http().post(taskUrl(workspace, task, '/attachments')), session).attach(
      'file',
      Buffer.from(content),
      { filename, contentType: mimeType },
    );
  }

  async function uploadedAttachment(
    workspace: WorkspaceBody,
    session: Session,
    task: TaskBody,
  ): Promise<AttachmentBody> {
    const response = await uploadToTask(workspace, session, task).expect(201);

    return response.body as AttachmentBody;
  }

  function dependOn(
    workspace: WorkspaceBody,
    session: Session,
    task: TaskBody,
    body: Record<string, unknown>,
  ): request.Test {
    return withAuth(http().post(taskUrl(workspace, task, '/dependencies')), session).send(body);
  }

  async function activityOf(
    workspace: WorkspaceBody,
    session: Session,
    task: TaskBody,
  ): Promise<ActivityBody[]> {
    const response = await withAuth(
      http().get(taskUrl(workspace, task, '/activity')),
      session,
    ).expect(200);

    return response.body.items as ActivityBody[];
  }

  describe('checklists', () => {
    it('cria a checklist, adiciona itens aninhados e marca o item como feito', async () => {
      const { owner, workspace, task } = await setup();
      const member = await addMember(workspace, owner, 'member');

      const checklist = await createChecklist(workspace, owner, task);

      expect(checklist.items).toEqual([]);

      const withRoot = await addItem(workspace, owner, checklist, {
        text: 'Validar o troco',
        assigneeId: member.userId,
      });
      const root = withRoot.items[0];

      expect(root.assigneeId).toBe(member.userId);

      const withChild = await addItem(workspace, owner, checklist, {
        text: 'Conferir a sangria',
        parentItemId: root.id,
      });

      expect(withChild.items).toHaveLength(2);
      expect(withChild.items[1].parentItemId).toBe(root.id);

      const done = await withAuth(
        http().patch(
          `/api/v1/workspaces/${workspace.id}/checklists/${checklist.id}/items/${root.id}`,
        ),
        owner,
      )
        .send({ done: true })
        .expect(200);

      expect((done.body as ChecklistBody).items[0].done).toBe(true);
    });

    it('remove o item junto com os subitens e apaga a checklist', async () => {
      const { owner, workspace, task } = await setup();
      const checklist = await createChecklist(workspace, owner, task);
      const root = (await addItem(workspace, owner, checklist, { text: 'Raiz' })).items[0];

      await addItem(workspace, owner, checklist, { text: 'Filho', parentItemId: root.id });

      const removed = await withAuth(
        http().delete(
          `/api/v1/workspaces/${workspace.id}/checklists/${checklist.id}/items/${root.id}`,
        ),
        owner,
      ).expect(200);

      expect((removed.body as ChecklistBody).items).toEqual([]);

      await withAuth(
        http().delete(`/api/v1/workspaces/${workspace.id}/checklists/${checklist.id}`),
        owner,
      ).expect(200);

      const list = await withAuth(
        http().get(taskUrl(workspace, task, '/checklists')),
        owner,
      ).expect(200);

      expect(list.body).toEqual([]);
    });

    it('recusa o nome vazio e o subitem de um subitem', async () => {
      const { owner, workspace, task } = await setup();

      await withAuth(http().post(taskUrl(workspace, task, '/checklists')), owner)
        .send({ name: '' })
        .expect(400);

      const checklist = await createChecklist(workspace, owner, task);
      const root = (await addItem(workspace, owner, checklist, { text: 'Raiz' })).items[0];
      const child = (
        await addItem(workspace, owner, checklist, { text: 'Filho', parentItemId: root.id })
      ).items[1];

      const invalid = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/checklists/${checklist.id}/items`),
        owner,
      )
        .send({ text: 'Neto', parentItemId: child.id })
        .expect(400);

      expect(invalid.body.code).toBe('INVALID_CHECKLIST_PARENT');
    });

    it('guest sem acesso não vê nem cria checklist', async () => {
      const { owner, workspace, task } = await setup();
      const guest = await addMember(workspace, owner, 'guest');

      await createChecklist(workspace, owner, task);

      const denied = await withAuth(
        http().get(taskUrl(workspace, task, '/checklists')),
        guest.session,
      ).expect(404);

      expect(denied.body.code).toBe('TASK_NOT_FOUND');

      await withAuth(http().post(taskUrl(workspace, task, '/checklists')), guest.session)
        .send({ name: 'Minha' })
        .expect(404);
    });

    it('guest com view não edita a checklist', async () => {
      const { owner, workspace, list, task } = await setup();
      const guest = await addMember(workspace, owner, 'guest');

      await share(workspace, owner, list.id, guest.userId, 'view').expect(201);

      const checklist = await createChecklist(workspace, owner, task);

      await withAuth(http().get(taskUrl(workspace, task, '/checklists')), guest.session).expect(
        200,
      );

      const forbidden = await withAuth(
        http().patch(`/api/v1/workspaces/${workspace.id}/checklists/${checklist.id}`),
        guest.session,
      )
        .send({ name: 'Outro' })
        .expect(403);

      expect(forbidden.body.code).toBe('FORBIDDEN_RESOURCE');
    });
  });

  describe('comentários', () => {
    it('monta a thread com o comentário raiz e as respostas', async () => {
      const { owner, workspace, task } = await setup();
      const member = await addMember(workspace, owner, 'member');

      const root = await createComment(workspace, owner, task, { bodyText: 'Abrindo a discussão' });
      const reply = await createComment(workspace, member.session, task, {
        bodyText: 'Respondendo',
        parentCommentId: root.id,
      });
      const nested = await createComment(workspace, owner, task, {
        bodyText: 'Resposta da resposta',
        parentCommentId: reply.id,
      });

      expect(reply.parentCommentId).toBe(root.id);
      expect(nested.parentCommentId).toBe(root.id);

      const threads = await withAuth(
        http().get(taskUrl(workspace, task, '/comments')),
        owner,
      ).expect(200);

      const items = threads.body.items as ThreadBody[];

      expect(items).toHaveLength(1);
      expect(items[0].comment.id).toBe(root.id);
      expect(items[0].replies.map((item) => item.id)).toEqual([reply.id, nested.id]);
    });

    it('extrai as menções do body e ignora quem não é membro ativo', async () => {
      const { owner, workspace, task } = await setup();
      const member = await addMember(workspace, owner, 'member');

      const comment = await createComment(workspace, owner, task, {
        bodyText: 'Olá @Membro',
        body: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'mention', attrs: { id: member.userId } },
                { type: 'mention', attrs: { id: FOREIGN_USER_ID } },
              ],
            },
          ],
        },
      });

      expect(comment.mentions).toEqual([member.userId]);
    });

    it('edita só pelo autor, marca editedAt e alterna a reação', async () => {
      const { owner, workspace, task } = await setup();
      const member = await addMember(workspace, owner, 'member');
      const comment = await createComment(workspace, owner, task);

      const edited = await withAuth(
        http().patch(`/api/v1/workspaces/${workspace.id}/comments/${comment.id}`),
        owner,
      )
        .send({ bodyText: 'Texto revisado' })
        .expect(200);

      expect((edited.body as CommentBody).bodyText).toBe('Texto revisado');
      expect((edited.body as CommentBody).editedAt).not.toBeNull();

      const forbidden = await withAuth(
        http().patch(`/api/v1/workspaces/${workspace.id}/comments/${comment.id}`),
        member.session,
      )
        .send({ bodyText: 'Não pode' })
        .expect(403);

      expect(forbidden.body.code).toBe('FORBIDDEN_COMMENT');

      const reacted = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/comments/${comment.id}/reactions`),
        member.session,
      )
        .send({ emoji: '👍' })
        .expect(200);

      expect((reacted.body as CommentBody).reactions).toEqual([
        { emoji: '👍', userIds: [member.userId] },
      ]);

      const removed = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/comments/${comment.id}/reactions`),
        member.session,
      )
        .send({ emoji: '👍' })
        .expect(200);

      expect((removed.body as CommentBody).reactions).toEqual([]);
    });

    it('lista o comentário atribuído em assigned-comments e o tira ao resolver', async () => {
      const { owner, workspace, task } = await setup();
      const member = await addMember(workspace, owner, 'member');

      const comment = await createComment(workspace, owner, task, {
        bodyText: 'Revisar o cálculo',
        assigneeId: member.userId,
      });

      expect(comment.assigneeId).toBe(member.userId);

      const open = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/assigned-comments`),
        member.session,
      )
        .query({ status: 'open' })
        .expect(200);

      expect((open.body.items as CommentBody[]).map((item) => item.id)).toEqual([comment.id]);

      const resolved = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/comments/${comment.id}/resolve`),
        member.session,
      ).expect(200);

      expect((resolved.body as CommentBody).resolvedAt).not.toBeNull();

      const stillOpen = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/assigned-comments`),
        member.session,
      )
        .query({ status: 'open' })
        .expect(200);

      expect(stillOpen.body.items).toEqual([]);

      const closed = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/assigned-comments`),
        member.session,
      )
        .query({ status: 'resolved' })
        .expect(200);

      expect((closed.body.items as CommentBody[]).map((item) => item.id)).toEqual([comment.id]);
    });

    it('lista em /replies as respostas de outras pessoas aos meus comentários', async () => {
      const { owner, workspace, task } = await setup();
      const member = await addMember(workspace, owner, 'member');
      const root = await createComment(workspace, owner, task);

      await createComment(workspace, owner, task, {
        bodyText: 'Comentário meu',
        parentCommentId: root.id,
      });

      const reply = await createComment(workspace, member.session, task, {
        bodyText: 'Resposta de outra pessoa',
        parentCommentId: root.id,
      });

      const mine = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/replies`),
        owner,
      ).expect(200);

      expect((mine.body.items as CommentBody[]).map((item) => item.id)).toEqual([reply.id]);
    });

    it('recusa texto vazio, pai de outra tarefa e responsável de fora', async () => {
      const { owner, workspace, list, task } = await setup();
      const other = await createTask(workspace, owner, list, 'Outra tarefa');

      await commentOn(workspace, owner, task, { bodyText: '' }).expect(400);

      const comment = await createComment(workspace, owner, other);
      const invalidParent = await commentOn(workspace, owner, task, {
        bodyText: 'Resposta',
        parentCommentId: comment.id,
      }).expect(400);

      expect(invalidParent.body.code).toBe('INVALID_COMMENT_PARENT');

      const invalidAssignee = await commentOn(workspace, owner, task, {
        bodyText: 'Para quem não é membro',
        assigneeId: FOREIGN_USER_ID,
      }).expect(400);

      expect(invalidAssignee.body.code).toBe('INVALID_COMMENT_ASSIGNEE');
    });

    it('guest sem acesso não comenta e o guest com view também não', async () => {
      const { owner, workspace, list, task } = await setup();
      const guest = await addMember(workspace, owner, 'guest');

      const notFound = await commentOn(workspace, guest.session, task, {
        bodyText: 'Oi',
      }).expect(404);

      expect(notFound.body.code).toBe('TASK_NOT_FOUND');

      await share(workspace, owner, list.id, guest.userId, 'view').expect(201);

      const forbidden = await commentOn(workspace, guest.session, task, {
        bodyText: 'Oi',
      }).expect(403);

      expect(forbidden.body.code).toBe('FORBIDDEN_RESOURCE');

      await share(workspace, owner, list.id, guest.userId, 'comment').expect(201);

      await commentOn(workspace, guest.session, task, { bodyText: 'Agora sim' }).expect(201);
    });
  });

  describe('anexos', () => {
    it('envia o arquivo, lista e devolve os bytes no download', async () => {
      const { owner, workspace, task } = await setup();

      const attachment = await uploadedAttachment(workspace, owner, task);

      expect(attachment.name).toBe('relatorio.txt');
      expect(attachment.mimeType).toBe('text/plain');
      expect(attachment.size).toBe(Buffer.from('relatorio').length);
      expect(attachment.storageKey).toBeUndefined();

      const list = await withAuth(
        http().get(taskUrl(workspace, task, '/attachments')),
        owner,
      ).expect(200);

      expect((list.body as AttachmentBody[]).map((item) => item.id)).toEqual([attachment.id]);

      const download = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/attachments/${attachment.id}/download`),
        owner,
      ).expect(200);

      expect(download.headers['content-type']).toContain('text/plain');
      expect(download.text).toBe('relatorio');
    });

    it('anexa ao comentário e exclui o anexo', async () => {
      const { owner, workspace, task } = await setup();
      const comment = await createComment(workspace, owner, task);

      const response = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/comments/${comment.id}/attachments`),
        owner,
      )
        .attach('file', Buffer.from('%PDF-1.4'), {
          filename: 'contrato.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      const attachment = response.body as AttachmentBody;

      expect(attachment.entityType).toBe('comment');
      expect(attachment.entityId).toBe(comment.id);

      await withAuth(
        http().delete(`/api/v1/workspaces/${workspace.id}/attachments/${attachment.id}`),
        owner,
      ).expect(200);

      await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/attachments/${attachment.id}/download`),
        owner,
      ).expect(404);
    });

    it('recusa o MIME fora da lista e a requisição sem arquivo', async () => {
      const { owner, workspace, task } = await setup();

      const invalid = await withAuth(http().post(taskUrl(workspace, task, '/attachments')), owner)
        .attach('file', Buffer.from('MZ'), {
          filename: 'virus.exe',
          contentType: 'application/x-msdownload',
        })
        .expect(400);

      expect(invalid.body.code).toBe('INVALID_FILE_TYPE');

      const empty = await withAuth(http().post(taskUrl(workspace, task, '/attachments')), owner)
        .field('nome', 'sem arquivo')
        .expect(400);

      expect(empty.body.code).toBe('FILE_REQUIRED');
    });

    it('download sem permissão na tarefa responde 404', async () => {
      const { owner, workspace, list, task } = await setup();
      const guest = await addMember(workspace, owner, 'guest');
      const attachment = await uploadedAttachment(workspace, owner, task);
      const url = `/api/v1/workspaces/${workspace.id}/attachments/${attachment.id}/download`;

      const denied = await withAuth(http().get(url), guest.session).expect(404);

      expect(denied.body.code).toBe('TASK_NOT_FOUND');

      await share(workspace, owner, list.id, guest.userId, 'view').expect(201);

      await withAuth(http().get(url), guest.session).expect(200);
    });
  });

  describe('dependências', () => {
    it('cria a dependência e lista nos dois sentidos', async () => {
      const { owner, workspace, list, task } = await setup();
      const other = await createTask(workspace, owner, list, 'Publicar release');

      const created = await dependOn(workspace, owner, task, {
        dependsOnId: other.id,
        type: 'waiting_on',
      }).expect(201);

      const dependency = created.body as DependencyBody;

      expect(dependency.taskId).toBe(task.id);
      expect(dependency.dependsOnId).toBe(other.id);

      const fromOther = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/tasks/${other.id}/dependencies`),
        owner,
      ).expect(200);

      expect((fromOther.body as DependencyBody[]).map((item) => item.id)).toEqual([dependency.id]);

      await withAuth(
        http().delete(`/api/v1/workspaces/${workspace.id}/dependencies/${dependency.id}`),
        owner,
      ).expect(200);

      const after = await withAuth(
        http().get(taskUrl(workspace, task, '/dependencies')),
        owner,
      ).expect(200);

      expect(after.body).toEqual([]);
    });

    it('lista em lote as dependências entre as tarefas pedidas', async () => {
      const { owner, workspace, list, task } = await setup();
      const second = await createTask(workspace, owner, list, 'Segunda');
      const outside = await createTask(workspace, owner, list, 'Fora do recorte');

      await dependOn(workspace, owner, task, {
        dependsOnId: second.id,
        type: 'waiting_on',
      }).expect(201);

      await dependOn(workspace, owner, task, {
        dependsOnId: outside.id,
        type: 'waiting_on',
      }).expect(201);

      const url = `/api/v1/workspaces/${workspace.id}/dependencies`;
      const inRange = await withAuth(
        http()
          .get(url)
          .query({ taskIds: `${task.id},${second.id}` }),
        owner,
      ).expect(200);

      const edges = inRange.body as DependencyBody[];

      expect(edges).toHaveLength(1);
      expect(edges[0]?.dependsOnId).toBe(second.id);

      await withAuth(http().get(url).query({ taskIds: 'nao-e-id' }), owner).expect(400);

      const guest = await addMember(workspace, owner, 'guest');
      const denied = await withAuth(
        http()
          .get(url)
          .query({ taskIds: `${task.id},${second.id}` }),
        guest.session,
      ).expect(200);

      expect(denied.body).toEqual([]);

      await share(workspace, owner, list.id, guest.userId, 'view').expect(201);

      const shared = await withAuth(
        http()
          .get(url)
          .query({ taskIds: `${task.id},${second.id}` }),
        guest.session,
      ).expect(200);

      expect(shared.body).toHaveLength(1);
    });

    it('rejeita a auto-referência e o ciclo', async () => {
      const { owner, workspace, list, task } = await setup();
      const second = await createTask(workspace, owner, list, 'Segunda');
      const third = await createTask(workspace, owner, list, 'Terceira');

      const self = await dependOn(workspace, owner, task, {
        dependsOnId: task.id,
        type: 'waiting_on',
      }).expect(400);

      expect(self.body.code).toBe('INVALID_DEPENDENCY');

      await dependOn(workspace, owner, task, {
        dependsOnId: second.id,
        type: 'waiting_on',
      }).expect(201);

      await dependOn(workspace, owner, second, {
        dependsOnId: third.id,
        type: 'waiting_on',
      }).expect(201);

      const cycle = await dependOn(workspace, owner, third, {
        dependsOnId: task.id,
        type: 'waiting_on',
      }).expect(400);

      expect(cycle.body.code).toBe('DEPENDENCY_CYCLE');

      const linked = await dependOn(workspace, owner, third, {
        dependsOnId: task.id,
        type: 'linked',
      }).expect(201);

      expect((linked.body as DependencyBody).type).toBe('linked');
    });

    it('recusa o tipo inválido e o guest sem acesso', async () => {
      const { owner, workspace, list, task } = await setup();
      const other = await createTask(workspace, owner, list, 'Outra');
      const guest = await addMember(workspace, owner, 'guest');

      await dependOn(workspace, owner, task, {
        dependsOnId: other.id,
        type: 'depende',
      }).expect(400);

      await dependOn(workspace, guest.session, task, {
        dependsOnId: other.id,
        type: 'waiting_on',
      }).expect(404);
    });
  });

  describe('histórico', () => {
    it('registra a criação e a mudança de status da tarefa', async () => {
      const { owner, workspace, task, statuses } = await setup();
      const active = statuses.find((status) => status.group === 'active');

      await withAuth(http().patch(taskUrl(workspace, task)), owner)
        .send({ statusId: active?.id })
        .expect(200);

      const items = await activityOf(workspace, owner, task);
      const status = items.find((item) =>
        item.changes.some((change) => change.field === 'statusId'),
      );

      expect(items.map((item) => item.action)).toContain('created');
      expect(status?.entityType).toBe('task');
      expect(status?.action).toBe('updated');
      expect(status?.changes).toEqual(
        expect.arrayContaining([
          { field: 'statusId', from: task.statusId, to: active?.id },
          { field: 'statusGroup', from: 'notStarted', to: 'active' },
        ]),
      );
    });

    it('registra o comentário criado e resolvido na view Activity', async () => {
      const { owner, workspace, list, task } = await setup();
      const comment = await createComment(workspace, owner, task);

      await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/comments/${comment.id}/resolve`),
        owner,
      ).expect(200);

      const feed = await withAuth(http().get(`/api/v1/workspaces/${workspace.id}/activity`), owner)
        .query({ location: 'list', locationId: list.id })
        .expect(200);

      const items = feed.body.items as ActivityBody[];
      const comments = items.filter((item) => item.entityType === 'comment');

      expect(comments.map((item) => item.action)).toEqual(['resolved', 'created']);
      expect(comments[0].entityId).toBe(comment.id);
    });

    it('guest sem acesso não lê o histórico da tarefa nem o do workspace', async () => {
      const { owner, workspace, task } = await setup();
      const guest = await addMember(workspace, owner, 'guest');

      await withAuth(http().get(taskUrl(workspace, task, '/activity')), guest.session).expect(404);

      const feed = await withAuth(
        http().get(`/api/v1/workspaces/${workspace.id}/activity`),
        guest.session,
      ).expect(200);

      expect(feed.body.items).toEqual([]);
    });
  });

  describe('detalhe da tarefa', () => {
    it('inclui subtarefas, checklists, dependências e contagens', async () => {
      const { owner, workspace, list, task, statuses } = await setup();
      const done = statuses.find((status) => status.group === 'done');
      const other = await createTask(workspace, owner, list, 'Publicar release');

      const subtask = await withAuth(
        http().post(`/api/v1/workspaces/${workspace.id}/lists/${list.id}/tasks`),
        owner,
      )
        .send({ name: 'Subtarefa', parentTaskId: task.id })
        .expect(201);

      await withAuth(
        http().patch(`/api/v1/workspaces/${workspace.id}/tasks/${subtask.body.id}`),
        owner,
      )
        .send({ statusId: done?.id })
        .expect(200);

      const checklist = await createChecklist(workspace, owner, task);

      await addItem(workspace, owner, checklist, { text: 'Item' });
      await createComment(workspace, owner, task);
      await uploadedAttachment(workspace, owner, task);
      await dependOn(workspace, owner, task, {
        dependsOnId: other.id,
        type: 'blocking',
      }).expect(201);

      const detail = await withAuth(http().get(taskUrl(workspace, task)), owner).expect(200);

      expect(detail.body.id).toBe(task.id);
      expect(detail.body.customId).toBe(task.customId);
      expect(detail.body.subtasks).toEqual({ total: 1, done: 1 });
      expect(detail.body.checklistItems).toEqual({ total: 1, done: 0 });
      expect(detail.body.checklists).toHaveLength(1);
      expect(detail.body.checklists[0].items).toHaveLength(1);
      expect(detail.body.dependencies).toHaveLength(1);
      expect(detail.body.attachmentCount).toBe(1);
      expect(detail.body.commentCount).toBe(1);
    });
  });
});
