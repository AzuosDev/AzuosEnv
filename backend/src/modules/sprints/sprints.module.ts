import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { TasksDataModule } from '../tasks/tasks-data.module';
import { TasksModule } from '../tasks/tasks.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { SprintFolder, SprintFolderSchema } from './schemas/sprint-folder.schema';
import { SprintFoldersController, SprintsController } from './sprints.controller';
import { SprintsService } from './sprints.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SprintFolder.name, schema: SprintFolderSchema }]),
    HierarchyModule,
    TasksDataModule,
    TasksModule,
    WorkspacesModule,
  ],
  controllers: [SprintFoldersController, SprintsController],
  providers: [SprintsService],
  exports: [SprintsService],
})
export class SprintsModule {}
