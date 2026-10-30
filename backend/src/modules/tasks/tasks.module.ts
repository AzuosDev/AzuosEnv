import { Module } from '@nestjs/common';
import { CollaborationDataModule } from '../collaboration/collaboration-data.module';
import { FavoritesDataModule } from '../favorites/favorites-data.module';
import { FieldsModule } from '../fields/fields.module';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { RecurrenceScheduler } from './recurrence.scheduler';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';
import { TaskAccessService } from './task-access.service';
import { TaskQueryService } from './task-query.service';
import { TasksDataModule } from './tasks-data.module';
import { ListTasksController, MyTasksController, TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    TasksDataModule,
    CollaborationDataModule,
    FavoritesDataModule,
    FieldsModule,
    HierarchyModule,
    WorkspacesModule,
    UsersModule,
  ],
  controllers: [ListTasksController, TasksController, MyTasksController, TagsController],
  providers: [TaskAccessService, TasksService, TaskQueryService, TagsService, RecurrenceScheduler],
  exports: [TasksService, TagsService, TaskQueryService, TaskAccessService, RecurrenceScheduler],
})
export class TasksModule {}
