import { Module } from '@nestjs/common';
import { CollaborationDataModule } from '../collaboration/collaboration-data.module';
import { FavoritesDataModule } from '../favorites/favorites-data.module';
import { FavoritesModule } from '../favorites/favorites.module';
import { FieldsModule } from '../fields/fields.module';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';
import { TasksDataModule } from '../tasks/tasks-data.module';
import { TasksModule } from '../tasks/tasks.module';
import { ViewsModule } from '../views/views.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { PurgeService } from './purge.service';
import { ArchivedController, TrashController } from './trash.controller';
import { TrashScheduler } from './trash.scheduler';
import { TrashService } from './trash.service';

@Module({
  imports: [
    HierarchyModule,
    TasksModule,
    TasksDataModule,
    CollaborationDataModule,
    FieldsModule,
    ViewsModule,
    NotificationsModule,
    FavoritesModule,
    FavoritesDataModule,
    StorageModule,
    WorkspacesModule,
  ],
  controllers: [TrashController, ArchivedController],
  providers: [TrashService, PurgeService, TrashScheduler],
  exports: [PurgeService],
})
export class TrashModule {}
