import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TasksDataModule } from '../tasks/tasks-data.module';
import { Activity, ActivitySchema } from './schemas/activity.schema';
import { Attachment, AttachmentSchema } from './schemas/attachment.schema';
import { Checklist, ChecklistSchema } from './schemas/checklist.schema';
import { Comment, CommentSchema } from './schemas/comment.schema';
import { TaskDependency, TaskDependencySchema } from './schemas/task-dependency.schema';
import { TaskCollaborationService } from './task-collaboration.service';

/**
 * Collections of the collaboration module. Separate from CollaborationModule so the
 * tasks module can read the summary of a task without a circular dependency.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Checklist.name, schema: ChecklistSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: Attachment.name, schema: AttachmentSchema },
      { name: TaskDependency.name, schema: TaskDependencySchema },
      { name: Activity.name, schema: ActivitySchema },
    ]),
    TasksDataModule,
  ],
  providers: [TaskCollaborationService],
  exports: [MongooseModule, TaskCollaborationService],
})
export class CollaborationDataModule {}
