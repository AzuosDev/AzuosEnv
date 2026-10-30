import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FavoritesDataModule } from '../favorites/favorites-data.module';
import { TasksDataModule } from '../tasks/tasks-data.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { FoldersController } from './folders.controller';
import { FoldersService } from './folders.service';
import { HierarchyAccessService } from './hierarchy-access.service';
import { ListsController } from './lists.controller';
import { ListsService } from './lists.service';
import { PermissionService } from './permission.service';
import { Folder, FolderSchema } from './schemas/folder.schema';
import { List, ListSchema } from './schemas/list.schema';
import { Permission, PermissionSchema } from './schemas/permission.schema';
import { Space, SpaceSchema } from './schemas/space.schema';
import { StatusSet, StatusSetSchema } from './schemas/status-set.schema';
import { SharingController } from './sharing.controller';
import { SharingService } from './sharing.service';
import { SpacesController } from './spaces.controller';
import { SpacesService } from './spaces.service';
import { StatusSetsController } from './status-sets.controller';
import { StatusSetsService } from './status-sets.service';
import { TreeController } from './tree.controller';
import { TreeService } from './tree.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Space.name, schema: SpaceSchema },
      { name: Folder.name, schema: FolderSchema },
      { name: List.name, schema: ListSchema },
      { name: StatusSet.name, schema: StatusSetSchema },
      { name: Permission.name, schema: PermissionSchema },
    ]),
    WorkspacesModule,
    TasksDataModule,
    FavoritesDataModule,
  ],
  controllers: [
    SpacesController,
    FoldersController,
    ListsController,
    StatusSetsController,
    SharingController,
    TreeController,
  ],
  providers: [
    PermissionService,
    HierarchyAccessService,
    StatusSetsService,
    SpacesService,
    FoldersService,
    ListsService,
    SharingService,
    TreeService,
  ],
  exports: [
    MongooseModule,
    PermissionService,
    HierarchyAccessService,
    SpacesService,
    FoldersService,
    ListsService,
    StatusSetsService,
  ],
})
export class HierarchyModule {}
