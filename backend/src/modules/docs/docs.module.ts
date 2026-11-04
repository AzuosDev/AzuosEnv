import { Module } from '@nestjs/common';
import { CollaborationDataModule } from '../collaboration/collaboration-data.module';
import { FavoritesDataModule } from '../favorites/favorites-data.module';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { TasksDataModule } from '../tasks/tasks-data.module';
import { ViewsModule } from '../views/views.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { DocPagesService } from './doc-pages.service';
import { DocsDataModule } from './docs-data.module';
import { DocPagesController, DocsController } from './docs.controller';
import { DocsService } from './docs.service';
import { PageCommentsService } from './page-comments.service';
import { PublicDocsController } from './public-docs.controller';

@Module({
  imports: [
    DocsDataModule,
    HierarchyModule,
    WorkspacesModule,
    TasksDataModule,
    CollaborationDataModule,
    FavoritesDataModule,
    ViewsModule,
  ],
  controllers: [DocsController, DocPagesController, PublicDocsController],
  providers: [DocsService, DocPagesService, PageCommentsService],
  exports: [DocsService],
})
export class DocsModule {}
