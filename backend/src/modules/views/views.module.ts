import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FieldsModule } from '../fields/fields.module';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { TasksDataModule } from '../tasks/tasks-data.module';
import { TasksModule } from '../tasks/tasks.module';
import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { View, ViewSchema } from './schemas/view.schema';
import { ViewExportService } from './view-export.service';
import { ViewsController } from './views.controller';
import { ViewsListener } from './views.listener';
import { ViewsService } from './views.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: View.name, schema: ViewSchema }]),
    TasksModule,
    TasksDataModule,
    FieldsModule,
    HierarchyModule,
    WorkspacesModule,
    UsersModule,
  ],
  controllers: [ViewsController],
  providers: [ViewsService, ViewExportService, ViewsListener],
  exports: [MongooseModule, ViewsService],
})
export class ViewsModule {}
