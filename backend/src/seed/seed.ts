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
import { StatusTemplate } from '../modules/hierarchy/status-templates';
import { UsersService } from '../modules/users/users.service';
import { Workspace, WorkspaceDocument } from '../modules/workspaces/schemas/workspace.schema';
import { WorkspacesService } from '../modules/workspaces/workspaces.service';

const SEED_NAME = process.env.SEED_NAME ?? 'Azuos Admin';
const SEED_EMAIL = process.env.SEED_EMAIL ?? 'admin@azuos.dev';
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'Azuos2026';

const logger = new Logger('Seed');

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
    await ensureList(clientes, cenio, 'uSolutionsPDV — Sprint 3');
    const centralMotos = await ensureFolder(clientes, 'Central Motos');
    await ensureList(clientes, centralMotos, 'Plano empresarial');

    await ensureSpace('Produtos', 'dev');

    const comercial = await ensureSpace('Comercial', 'comercial');
    await ensureList(comercial, null, 'Leads');
    await ensureList(comercial, null, 'Orçamentos');

    await ensureSpace('Interno', 'simples');

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
