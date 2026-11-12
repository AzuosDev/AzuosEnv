import { Module } from '@nestjs/common';
import { DocsDataModule } from '../docs/docs-data.module';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { TasksModule } from '../tasks/tasks.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { FavoritesDataModule } from './favorites-data.module';
import { FavoritesController, RecentsController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

@Module({
  imports: [FavoritesDataModule, DocsDataModule, HierarchyModule, TasksModule, WorkspacesModule],
  controllers: [FavoritesController, RecentsController],
  providers: [FavoritesService],
  exports: [FavoritesService],
})
export class FavoritesModule {}
