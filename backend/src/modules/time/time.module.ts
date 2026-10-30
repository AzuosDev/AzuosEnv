import { Module } from '@nestjs/common';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { TasksDataModule } from '../tasks/tasks-data.module';
import { TasksModule } from '../tasks/tasks.module';
import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ClientsService } from './clients.service';
import { TimeDataModule } from './time-data.module';
import { TimeEntriesController, TimerController } from './time.controller';
import { TimeEntriesService } from './time-entries.service';
import { TimesheetsController } from './timesheets.controller';
import { TimesheetsService } from './timesheets.service';
import { WorkloadController } from './workload.controller';
import { WorkloadService } from './workload.service';

@Module({
  imports: [
    TimeDataModule,
    TasksDataModule,
    TasksModule,
    HierarchyModule,
    WorkspacesModule,
    UsersModule,
  ],
  controllers: [TimerController, TimeEntriesController, TimesheetsController, WorkloadController],
  providers: [TimeEntriesService, TimesheetsService, WorkloadService, ClientsService],
  exports: [TimeDataModule, TimeEntriesService, WorkloadService, ClientsService],
})
export class TimeModule {}
