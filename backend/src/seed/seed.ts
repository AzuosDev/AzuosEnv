import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { FoldersService } from '../modules/hierarchy/folders.service';
import { ListsService } from '../modules/hierarchy/lists.service';
import { PermissionContext } from '../modules/hierarchy/permission.service';
import { Folder, FolderDocument } from '../modules/hierarchy/schemas/folder.schema';
import { List, ListDocument } from '../modules/hierarchy/schemas/list.schema';
import { Space, SpaceDocument } from '../modules/hierarchy/schemas/space.schema';
import { SpacesService } from '../modules/hierarchy/spaces.service';
import { StatusSetsService } from '../modules/hierarchy/status-sets.service';
import { StatusTemplate } from '../modules/hierarchy/status-templates';
import { CountersService } from '../modules/tasks/counters.service';
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

    logger.log(`Workspace ${workspace.name} (${workspace.taskPrefix}) pronto.`);
    logger.log(`Acesso: ${SEED_EMAIL}`);
  } finally {
    await app.close();
  }
}

void run().catch((error: unknown) => {
  logger.error('Falha no seed.', error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
