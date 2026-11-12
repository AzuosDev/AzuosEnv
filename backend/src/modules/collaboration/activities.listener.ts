import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  TASK_CREATED,
  TASK_DELETED,
  TASK_MOVED,
  TASK_UPDATED,
  TaskCreatedEvent,
  TaskDeletedEvent,
  TaskMovedEvent,
  TaskUpdatedEvent,
} from '../tasks/task-events';
import { ActivitiesService } from './activities.service';
import {
  COMMENT_CREATED,
  COMMENT_UPDATED,
  CommentCreatedEvent,
  CommentUpdatedEvent,
} from './collaboration-events';

/** Turns the domain events into the history rows of the task and of the Activity view. */
@Injectable()
export class ActivitiesListener {
  private readonly logger = new Logger(ActivitiesListener.name);

  constructor(private readonly activities: ActivitiesService) {}

  @OnEvent(TASK_CREATED)
  async onTaskCreated(event: TaskCreatedEvent): Promise<void> {
    await this.write({
      workspaceId: event.workspaceId,
      entityType: 'task',
      entityId: event.taskId,
      action: 'created',
      actorId: event.actorId,
      taskId: event.taskId,
      listId: event.listId,
    });
  }

  @OnEvent(TASK_UPDATED)
  async onTaskUpdated(event: TaskUpdatedEvent): Promise<void> {
    await this.write({
      workspaceId: event.workspaceId,
      entityType: 'task',
      entityId: event.taskId,
      action: 'updated',
      actorId: event.actorId,
      changes: event.changes,
      taskId: event.taskId,
      listId: event.listId,
    });
  }

  @OnEvent(TASK_MOVED)
  async onTaskMoved(event: TaskMovedEvent): Promise<void> {
    await this.write({
      workspaceId: event.workspaceId,
      entityType: 'task',
      entityId: event.taskId,
      action: 'moved',
      actorId: event.actorId,
      changes: {
        listId: { from: String(event.fromListId), to: String(event.toListId) },
      },
      taskId: event.taskId,
      listId: event.toListId,
    });
  }

  @OnEvent(TASK_DELETED)
  async onTaskDeleted(event: TaskDeletedEvent): Promise<void> {
    await this.write({
      workspaceId: event.workspaceId,
      entityType: 'task',
      entityId: event.taskId,
      action: 'deleted',
      actorId: event.actorId,
      taskId: event.taskId,
      listId: event.listId,
    });
  }

  @OnEvent(COMMENT_CREATED)
  async onCommentCreated(event: CommentCreatedEvent): Promise<void> {
    await this.write({
      workspaceId: event.workspaceId,
      entityType: 'comment',
      entityId: event.commentId,
      action: 'created',
      actorId: event.actorId,
      taskId: event.taskId,
      listId: event.listId,
    });
  }

  @OnEvent(COMMENT_UPDATED)
  async onCommentUpdated(event: CommentUpdatedEvent): Promise<void> {
    await this.write({
      workspaceId: event.workspaceId,
      entityType: 'comment',
      entityId: event.commentId,
      action: resolutionAction(event),
      actorId: event.actorId,
      changes: event.changes,
      taskId: event.taskId,
      listId: event.listId,
    });
  }

  /** The history must never break the request that emitted the event. */
  private async write(input: Parameters<ActivitiesService['record']>[0]): Promise<void> {
    try {
      await this.activities.record(input);
    } catch (error) {
      this.logger.error(
        `Falha ao gravar atividade ${input.entityType}.${input.action}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

function resolutionAction(event: CommentUpdatedEvent): 'resolved' | 'unresolved' | 'updated' {
  const resolved = event.changes.resolvedAt;

  if (!resolved) {
    return 'updated';
  }

  return resolved.to === null ? 'unresolved' : 'resolved';
}
