import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { TasksDataModule } from '../tasks/tasks-data.module';
import { TasksModule } from '../tasks/tasks.module';
import { TimeModule } from '../time/time.module';
import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { CardDataService } from './card-data.service';
import { DashboardsController } from './dashboards.controller';
import { DashboardsService } from './dashboards.service';
import { Dashboard, DashboardSchema } from './schemas/dashboard.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Dashboard.name, schema: DashboardSchema }]),
    TimeModule,
    TasksDataModule,
    TasksModule,
    HierarchyModule,
    WorkspacesModule,
    UsersModule,
  ],
  controllers: [DashboardsController],
  providers: [DashboardsService, CardDataService],
  exports: [DashboardsService],
})
export class DashboardsModule {}
