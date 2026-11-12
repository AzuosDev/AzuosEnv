import { Module } from '@nestjs/common';
import { ChatDataModule } from '../chat/chat-data.module';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { StorageModule } from '../storage/storage.module';
import { TasksModule } from '../tasks/tasks.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ActivitiesListener } from './activities.listener';
import { ActivitiesService } from './activities.service';
import { ActivityController, TaskActivityController } from './activities.controller';
import {
  AttachmentsController,
  ChannelAttachmentsController,
  CommentAttachmentsController,
  TaskAttachmentsController,
} from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { ChecklistsController, TaskChecklistsController } from './checklists.controller';
import { ChecklistsService } from './checklists.service';
import { CollaborationDataModule } from './collaboration-data.module';
import {
  CommentInboxController,
  CommentsController,
  TaskCommentsController,
} from './comments.controller';
import { CommentsService } from './comments.service';
import { DependenciesController, TaskDependenciesController } from './dependencies.controller';
import { DependenciesService } from './dependencies.service';

@Module({
  imports: [
    CollaborationDataModule,
    TasksModule,
    HierarchyModule,
    WorkspacesModule,
    StorageModule,
    ChatDataModule,
  ],
  controllers: [
    TaskChecklistsController,
    ChecklistsController,
    TaskCommentsController,
    CommentsController,
    CommentInboxController,
    TaskAttachmentsController,
    CommentAttachmentsController,
    ChannelAttachmentsController,
    AttachmentsController,
    TaskDependenciesController,
    DependenciesController,
    TaskActivityController,
    ActivityController,
  ],
  providers: [
    ChecklistsService,
    CommentsService,
    AttachmentsService,
    DependenciesService,
    ActivitiesService,
    ActivitiesListener,
  ],
  exports: [ChecklistsService, CommentsService],
})
export class CollaborationModule {}
