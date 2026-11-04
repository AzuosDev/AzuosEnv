import { INestApplicationContext, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppModule } from '../app.module';
import { CustomFieldsService } from '../modules/fields/custom-fields.service';
import { CreateCustomFieldDto } from '../modules/fields/dto/custom-field.dto';
import { CustomField } from '../modules/fields/schemas/custom-field.schema';
import { FoldersService } from '../modules/hierarchy/folders.service';
import { ListsService } from '../modules/hierarchy/lists.service';
import { PermissionContext } from '../modules/hierarchy/permission.service';
import { Folder, FolderDocument } from '../modules/hierarchy/schemas/folder.schema';
import { List, ListDocument } from '../modules/hierarchy/schemas/list.schema';
import { Space, SpaceDocument } from '../modules/hierarchy/schemas/space.schema';
import { SpacesService } from '../modules/hierarchy/spaces.service';
import { StatusSetsService } from '../modules/hierarchy/status-sets.service';
import { StatusTemplate } from '../modules/hierarchy/status-templates';
import { ChannelsService } from '../modules/chat/channels.service';
import { Channel } from '../modules/chat/schemas/channel.schema';
import { MessagesService } from '../modules/chat/messages.service';
import { CommentsService } from '../modules/collaboration/comments.service';
import { Comment } from '../modules/collaboration/schemas/comment.schema';
import { DocPagesService } from '../modules/docs/doc-pages.service';
import { DocsService } from '../modules/docs/docs.service';
import { Doc } from '../modules/docs/schemas/doc.schema';
import { GoalFoldersService } from '../modules/goals/goal-folders.service';
import { GoalsService } from '../modules/goals/goals.service';
import { Goal } from '../modules/goals/schemas/goal.schema';
import { TargetsService } from '../modules/goals/targets.service';
import { NotificationsService } from '../modules/notifications/notifications.service';
import { Notification } from '../modules/notifications/schemas/notification.schema';
import { CountersService } from '../modules/tasks/counters.service';
import { TimeEntriesService } from '../modules/time/time-entries.service';
import { TimeEntry } from '../modules/time/schemas/time-entry.schema';
import { Task } from '../modules/tasks/schemas/task.schema';
import { TasksService } from '../modules/tasks/tasks.service';
import { TaskPriority, TaskType } from '../modules/tasks/task-fields';
import { UsersService } from '../modules/users/users.service';
import { Workspace, WorkspaceDocument } from '../modules/workspaces/schemas/workspace.schema';
import { WorkspacesService } from '../modules/workspaces/workspaces.service';

const SEED_NAME = process.env.SEED_NAME ?? 'Azuos Admin';
const SEED_EMAIL = process.env.SEED_EMAIL ?? 'admin@azuos.dev';
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'Azuos2026';

const logger = new Logger('Seed');

/** First visible task id of the seed is AZD-142, as in the prototype. */
const FIRST_TASK_SEQ = 141;

interface SeedTask {
  name: string;
  status: string;
  priority: TaskPriority | null;
  type: TaskType;
  dueInDays?: number;
  estimateMinutes?: number;
  points?: number;
}

/** Sprint 3 of uSolutionsPDV (AZD-142 a AZD-149). */
const SPRINT_TASKS: SeedTask[] = [
  {
    name: 'Corrigir fechamento de caixa com sangria parcial',
    status: 'Em andamento',
    priority: 'urgent',
    type: 'bug',
    dueInDays: 1,
    estimateMinutes: 240,
    points: 3,
  },
  {
    name: 'Integração TEF Stone — homologação',
    status: 'Homologação cliente',
    priority: 'high',
    type: 'task',
    dueInDays: 3,
    estimateMinutes: 480,
    points: 5,
  },
  {
    name: 'Relatório de vendas por vendedor',
    status: 'A fazer',
    priority: 'normal',
    type: 'task',
    dueInDays: 7,
    estimateMinutes: 360,
    points: 3,
  },
  {
    name: 'Importação de produtos via planilha',
    status: 'Backlog',
    priority: 'normal',
    type: 'task',
    estimateMinutes: 600,
    points: 5,
  },
  {
    name: 'Impressão de cupom não fiscal em 58mm',
    status: 'Teste',
    priority: 'high',
    type: 'bug',
    dueInDays: 2,
    estimateMinutes: 120,
    points: 2,
  },
  {
    name: 'Login por PIN no terminal',
    status: 'Code review',
    priority: 'normal',
    type: 'task',
    dueInDays: 4,
    estimateMinutes: 300,
    points: 3,
  },
  {
    name: 'Deploy da versão 3.2 no cliente Cênio',
    status: 'Deploy',
    priority: 'high',
    type: 'milestone',
    dueInDays: 10,
  },
  {
    name: 'Revisão de performance da tela de venda',
    status: 'Backlog',
    priority: 'low',
    type: 'task',
    estimateMinutes: 480,
    points: 8,
  },
];

type SeedField = Omit<CreateCustomFieldDto, 'scope' | 'scopeId'>;

/** Campos padrão da Azuos, no Space Clientes. */
const CLIENT_FIELDS: SeedField[] = [
  {
    name: 'Tipo',
    type: 'dropdown',
    config: {
      options: [
        { id: 'feature', name: 'Feature', color: '#2563EB' },
        { id: 'bug', name: 'Bug', color: '#DC2626' },
        { id: 'melhoria', name: 'Melhoria', color: '#7C3AED' },
        { id: 'suporte', name: 'Suporte', color: '#0891B2' },
      ],
    },
  },
  { name: 'Repositório', type: 'url' },
  { name: 'PR/Branch', type: 'text' },
  {
    name: 'Ambiente',
    type: 'dropdown',
    config: {
      options: [
        { id: 'dev', name: 'Dev', color: '#64748B' },
        { id: 'staging', name: 'Staging', color: '#D97706' },
        { id: 'producao', name: 'Produção', color: '#16A34A' },
      ],
    },
  },
  { name: 'Versão', type: 'text' },
  { name: 'Faturável', type: 'checkbox' },
  { name: 'Valor', type: 'currency', config: { currency: 'BRL', precision: 2 } },
];

function inDays(days: number): string {
  const date = new Date();

  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(21, 0, 0, 0);

  return date.toISOString();
}

/** Creates the Azuos Dev workspace with its initial hierarchy. Safe to run again. */
async function run(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const users = app.get(UsersService);
    const workspaces = app.get(WorkspacesService);
    const spaces = app.get(SpacesService);
    const folders = app.get(FoldersService);
    const lists = app.get(ListsService);
    const workspaceModel = app.get<Model<Workspace>>(getModelToken(Workspace.name));
    const spaceModel = app.get<Model<Space>>(getModelToken(Space.name));
    const folderModel = app.get<Model<Folder>>(getModelToken(Folder.name));
    const listModel = app.get<Model<List>>(getModelToken(List.name));
    const taskModel = app.get<Model<Task>>(getModelToken(Task.name));
    const statusSets = app.get(StatusSetsService);
    const counters = app.get(CountersService);
    const tasks = app.get(TasksService);
    const fields = app.get(CustomFieldsService);
    const fieldModel = app.get<Model<CustomField>>(getModelToken(CustomField.name));

    const user =
      (await users.findByEmail(SEED_EMAIL)) ??
      (await users.create({ name: SEED_NAME, email: SEED_EMAIL, password: SEED_PASSWORD }));

    const workspace: WorkspaceDocument =
      (await workspaceModel.findOne({ slug: 'azuos-dev', deletedAt: null }).exec()) ??
      (await workspaces.create(String(user._id), { name: 'Azuos Dev', taskPrefix: 'AZD' }));

    const ctx: PermissionContext = {
      workspaceId: workspace._id,
      userId: workspace.ownerId,
      role: 'owner',
    };

    const ensureSpace = async (
      name: string,
      statusTemplate: StatusTemplate,
    ): Promise<SpaceDocument> =>
      (await spaceModel.findOne({ workspaceId: workspace._id, name, deletedAt: null }).exec()) ??
      (await spaces.create(ctx, { name, statusTemplate }));

    const ensureFolder = async (space: SpaceDocument, name: string): Promise<FolderDocument> =>
      (await folderModel
        .findOne({ workspaceId: workspace._id, spaceId: space._id, name, deletedAt: null })
        .exec()) ?? (await folders.create(ctx, { spaceId: String(space._id), name }));

    const ensureList = async (
      space: SpaceDocument,
      folder: FolderDocument | null,
      name: string,
    ): Promise<ListDocument> =>
      (await listModel
        .findOne({ workspaceId: workspace._id, spaceId: space._id, name, deletedAt: null })
        .exec()) ??
      (await lists.create(ctx, {
        spaceId: String(space._id),
        folderId: folder ? String(folder._id) : null,
        name,
      }));

    const clientes = await ensureSpace('Clientes', 'dev');
    const cenio = await ensureFolder(clientes, 'Cênio Construções');
    const sprint = await ensureList(clientes, cenio, 'uSolutionsPDV — Sprint 3');
    const centralMotos = await ensureFolder(clientes, 'Central Motos');
    await ensureList(clientes, centralMotos, 'Plano empresarial');

    await ensureSpace('Produtos', 'dev');

    const comercial = await ensureSpace('Comercial', 'comercial');
    await ensureList(comercial, null, 'Leads');
    await ensureList(comercial, null, 'Orçamentos');

    await ensureSpace('Interno', 'simples');

    for (const seedField of CLIENT_FIELDS) {
      const exists = await fieldModel
        .findOne({
          workspaceId: workspace._id,
          scope: 'space',
          scopeId: clientes._id,
          name: seedField.name,
        })
        .exec();

      if (!exists) {
        await fields.create(ctx, {
          ...seedField,
          scope: 'space',
          scopeId: String(clientes._id),
        });
      }
    }

    await counters.ensureAtLeast(workspace._id, FIRST_TASK_SEQ);

    const effective = await statusSets.resolveForList(sprint);
    const statusIdByName = new Map(
      effective.statuses.map((status) => [status.name, String(status._id)]),
    );

    for (const seedTask of SPRINT_TASKS) {
      const exists = await taskModel
        .findOne({ workspaceId: workspace._id, listId: sprint._id, name: seedTask.name })
        .exec();

      if (exists) {
        continue;
      }

      await tasks.create(ctx, sprint._id, workspace.taskPrefix, {
        name: seedTask.name,
        statusId: statusIdByName.get(seedTask.status),
        priority: seedTask.priority,
        type: seedTask.type,
        assigneeIds: [String(user._id)],
        dueAt: seedTask.dueInDays === undefined ? null : inDays(seedTask.dueInDays),
        dueHasTime: false,
        estimateMinutes: seedTask.estimateMinutes ?? null,
        points: seedTask.points ?? null,
      });
    }

    await seedCollaboration(app, ctx, workspace, sprint._id);

    logger.log(`Workspace ${workspace.name} (${workspace.taskPrefix}) pronto.`);
    logger.log(`Acesso: ${SEED_EMAIL}`);
  } finally {
    await app.close();
  }
}

/**
 * Content of the prototype that the screens of the front need in order to show
 * something real: comments, Inbox, hours, a goal, a channel and a Doc. Every block
 * checks whether it already exists, so the seed stays safe to run again.
 */
async function seedCollaboration(
  app: INestApplicationContext,
  ctx: PermissionContext,
  workspace: WorkspaceDocument,
  sprintListId: Types.ObjectId,
): Promise<void> {
  const taskModel = app.get<Model<Task>>(getModelToken(Task.name));
  const tasks = await taskModel
    .find({ workspaceId: workspace._id, listId: sprintListId })
    .sort({ position: 1 })
    .exec();

  if (tasks.length === 0) {
    return;
  }

  const [sangria, tef] = tasks;
  const comments = app.get(CommentsService);
  const commentModel = app.get<Model<Comment>>(getModelToken(Comment.name));

  if ((await commentModel.countDocuments({ workspaceId: workspace._id })) === 0) {
    await comments.create(ctx, String(sangria._id), {
      bodyText: 'Cliente confirmou que acontece só com sangria parcial. Reproduzido no caixa 2.',
    });
    await comments.create(ctx, String(sangria._id), {
      bodyText: 'Corrigido o arredondamento; subindo para homologação hoje.',
    });
    await comments.create(ctx, String(tef._id), {
      bodyText: 'Stone liberou as credenciais de homologação.',
    });
  }

  const notifications = app.get(NotificationsService);
  const notificationModel = app.get<Model<Notification>>(getModelToken(Notification.name));

  if ((await notificationModel.countDocuments({ workspaceId: workspace._id })) === 0) {
    await notifications.deliver({
      workspaceId: workspace._id,
      type: 'assigned',
      entityType: 'task',
      entityId: sangria._id,
      actorId: null,
      recipients: [{ userId: ctx.userId, bucket: 'primary' }],
      data: { taskName: sangria.name, customId: sangria.customId },
    });
    await notifications.deliver({
      workspaceId: workspace._id,
      type: 'dueSoon',
      entityType: 'task',
      entityId: tef._id,
      actorId: null,
      recipients: [{ userId: ctx.userId, bucket: 'primary' }],
      data: { taskName: tef.name, customId: tef.customId, dueAt: tef.dueAt },
    });
  }

  const timeEntries = app.get(TimeEntriesService);
  const timeEntryModel = app.get<Model<TimeEntry>>(getModelToken(TimeEntry.name));

  if ((await timeEntryModel.countDocuments({ workspaceId: workspace._id })) === 0) {
    await timeEntries.create(ctx, {
      taskId: String(sangria._id),
      start: inDays(-1),
      durationMinutes: 150,
      billable: true,
      note: 'Investigação e correção da sangria parcial.',
    });
    await timeEntries.create(ctx, {
      taskId: String(tef._id),
      start: inDays(0),
      durationMinutes: 90,
      billable: true,
      note: 'Preparo do ambiente de homologação da Stone.',
    });
  }

  const goals = app.get(GoalsService);
  const targets = app.get(TargetsService);
  const goalFolders = app.get(GoalFoldersService);
  const goalModel = app.get<Model<Goal>>(getModelToken(Goal.name));

  if ((await goalModel.countDocuments({ workspaceId: workspace._id })) === 0) {
    const folder = await goalFolders.create(ctx, { name: 'Metas 2026' });
    const goal = await goals.create(ctx, {
      folderId: String(folder._id),
      name: 'Entregar o PDV da Cênio',
      description: 'Fechar a Sprint 3 e subir a versão 3.2 em produção.',
      ownerIds: [String(ctx.userId)],
      dueDate: inDays(21),
    });

    await targets.create(ctx, goal, {
      name: 'Tarefas da Sprint 3 concluídas',
      type: 'tasks',
      listId: String(sprintListId),
    });
    await targets.create(ctx, goal, {
      name: 'Horas faturáveis no mês',
      type: 'number',
      start: 0,
      target: 160,
      current: 4,
      unit: 'h',
    });
  }

  const channels = app.get(ChannelsService);
  const messages = app.get(MessagesService);
  const channelModel = app.get<Model<Channel>>(getModelToken(Channel.name));

  if ((await channelModel.countDocuments({ workspaceId: workspace._id })) === 0) {
    const channel = await channels.create(ctx, {
      name: 'usolutionspdv',
      locationType: 'list',
      locationId: String(sprintListId),
    });

    await messages.create(ctx, channel._id, {
      bodyText: 'Sprint 3 começou. Foco no fechamento de caixa e no TEF.',
    });
    await messages.create(ctx, channel._id, {
      bodyText: 'Deploy da 3.2 na Cênio combinado para a próxima semana.',
    });
  }

  const docs = app.get(DocsService);
  const pages = app.get(DocPagesService);
  const docModel = app.get<Model<Doc>>(getModelToken(Doc.name));

  if ((await docModel.countDocuments({ workspaceId: workspace._id })) === 0) {
    const doc = await docs.create(ctx, {
      locationType: 'list',
      locationId: String(sprintListId),
      title: 'Guia do uSolutionsPDV',
      icon: 'book',
    });

    const root = await pages.create(ctx, doc._id, {
      title: 'Ambientes e versões',
      contentText:
        'Dev, staging e produção da Cênio. A versão 3.2 sobe depois da homologação do TEF.',
    });

    await pages.create(ctx, doc._id, {
      title: 'Checklist de deploy',
      parentPageId: String(root._id),
      contentText: 'Backup do banco, migração, smoke test no caixa 1 e aviso no canal do cliente.',
    });
  }
}

void run().catch((error: unknown) => {
  logger.error('Falha no seed.', error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
