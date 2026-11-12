import { Module } from '@nestjs/common';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { TasksDataModule } from '../tasks/tasks-data.module';
import { TasksModule } from '../tasks/tasks.module';
import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ClickUpImportService } from './clickup-import.service';
import { ExportController, ImportController } from './import.controller';
import { WorkspaceExportService } from './workspace-export.service';

@Module({
  imports: [HierarchyModule, TasksDataModule, TasksModule, UsersModule, WorkspacesModule],
  controllers: [ImportController, ExportController],
  providers: [ClickUpImportService, WorkspaceExportService],
})
export class ImportModule {}
