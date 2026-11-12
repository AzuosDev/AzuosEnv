import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task } from '../tasks/schemas/task.schema';
import { Attachment } from './schemas/attachment.schema';
import { Checklist, ChecklistDocument } from './schemas/checklist.schema';
import { Comment } from './schemas/comment.schema';
import { TaskDependency, TaskDependencyDocument } from './schemas/task-dependency.schema';

export interface SubtaskSummary {
  total: number;
  done: number;
}

export interface ChecklistSummary {
  total: number;
  done: number;
}

export interface TaskCollaborationSummary {
  subtasks: SubtaskSummary;
  checklists: ChecklistDocument[];
  checklistItems: ChecklistSummary;
  dependencies: TaskDependencyDocument[];
  attachmentCount: number;
  commentCount: number;
}

/**
 * Collaboration numbers of a single task. Lives in the data module so the tasks
 * module can build GET /tasks/:id without depending on the services.
 */
@Injectable()
export class TaskCollaborationService {
  constructor(
    @InjectModel(Task.name) private readonly tasks: Model<Task>,
    @InjectModel(Checklist.name) private readonly checklists: Model<Checklist>,
    @InjectModel(Comment.name) private readonly comments: Model<Comment>,
    @InjectModel(Attachment.name) private readonly attachments: Model<Attachment>,
    @InjectModel(TaskDependency.name) private readonly dependencies: Model<TaskDependency>,
  ) {}

  async summaryFor(
    workspaceId: Types.ObjectId,
    taskId: Types.ObjectId,
  ): Promise<TaskCollaborationSummary> {
    const [subtasks, checklists, dependencies, attachmentCount, commentCount] = await Promise.all([
      this.subtaskSummary(workspaceId, taskId),
      this.checklists.find({ workspaceId, taskId }).sort({ position: 1 }).exec(),
      this.dependencies
        .find({ workspaceId, $or: [{ taskId }, { dependsOnId: taskId }] })
        .sort({ _id: 1 })
        .exec(),
      this.attachments.countDocuments({ workspaceId, taskId }).exec(),
      this.comments
        .countDocuments({ workspaceId, entityType: 'task', entityId: taskId, deletedAt: null })
        .exec(),
    ]);

    return {
      subtasks,
      checklists,
      checklistItems: checklistItemSummary(checklists),
      dependencies,
      attachmentCount,
      commentCount,
    };
  }

  private async subtaskSummary(
    workspaceId: Types.ObjectId,
    taskId: Types.ObjectId,
  ): Promise<SubtaskSummary> {
    const scope = { workspaceId, parentTaskId: taskId, deletedAt: null };
    const [total, done] = await Promise.all([
      this.tasks.countDocuments(scope).exec(),
      this.tasks.countDocuments({ ...scope, statusGroup: { $in: ['done', 'closed'] } }).exec(),
    ]);

    return { total, done };
  }
}

function checklistItemSummary(checklists: ChecklistDocument[]): ChecklistSummary {
  return checklists.reduce<ChecklistSummary>(
    (summary, checklist) => ({
      total: summary.total + checklist.items.length,
      done: summary.done + checklist.items.filter((item) => item.done).length,
    }),
    { total: 0, done: 0 },
  );
}
