import { Module } from '@nestjs/common';
import { CollaborationDataModule } from '../collaboration/collaboration-data.module';
import { DocsDataModule } from '../docs/docs-data.module';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { TasksDataModule } from '../tasks/tasks-data.module';
import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [
    TasksDataModule,
    CollaborationDataModule,
    DocsDataModule,
    HierarchyModule,
    WorkspacesModule,
    UsersModule,
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
