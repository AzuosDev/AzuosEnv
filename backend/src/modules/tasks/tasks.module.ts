import { Module } from '@nestjs/common';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';
import { TaskAccessService } from './task-access.service';
import { TaskQueryService } from './task-query.service';
import { TasksDataModule } from './tasks-data.module';
import { ListTasksController, MyTasksController, TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [TasksDataModule, HierarchyModule, WorkspacesModule, UsersModule],
  controllers: [ListTasksController, TasksController, MyTasksController, TagsController],
  providers: [TaskAccessService, TasksService, TaskQueryService, TagsService],
  exports: [TasksService, TagsService, TaskQueryService],
})
export class TasksModule {}
