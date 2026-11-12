import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { TasksDataModule } from '../tasks/tasks-data.module';
import { TasksModule } from '../tasks/tasks.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { GoalFoldersService } from './goal-folders.service';
import { GoalFoldersController, GoalsController } from './goals.controller';
import { GoalsListener } from './goals.listener';
import { GoalsService } from './goals.service';
import { GoalFolder, GoalFolderSchema } from './schemas/goal-folder.schema';
import { Goal, GoalSchema } from './schemas/goal.schema';
import { Target, TargetSchema } from './schemas/target.schema';
import { TargetsService } from './targets.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Goal.name, schema: GoalSchema },
      { name: GoalFolder.name, schema: GoalFolderSchema },
      { name: Target.name, schema: TargetSchema },
    ]),
    TasksDataModule,
    TasksModule,
    HierarchyModule,
    WorkspacesModule,
  ],
  controllers: [GoalFoldersController, GoalsController],
  providers: [GoalsService, GoalFoldersService, TargetsService, GoalsListener],
  exports: [GoalsService, TargetsService],
})
export class GoalsModule {}
