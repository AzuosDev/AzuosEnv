import { Module } from '@nestjs/common';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { TasksModule } from '../tasks/tasks.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { WhiteboardsDataModule } from './whiteboards-data.module';
import { WhiteboardsController } from './whiteboards.controller';
import { WhiteboardsService } from './whiteboards.service';

@Module({
  imports: [WhiteboardsDataModule, HierarchyModule, TasksModule, WorkspacesModule],
  controllers: [WhiteboardsController],
  providers: [WhiteboardsService],
  exports: [WhiteboardsService],
})
export class WhiteboardsModule {}
