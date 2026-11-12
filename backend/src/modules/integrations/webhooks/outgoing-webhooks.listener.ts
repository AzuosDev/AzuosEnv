import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Types } from 'mongoose';
import { COMMENT_CREATED, CommentCreatedEvent } from '../../collaboration/collaboration-events';
import { MESSAGE_CREATED, MessageCreatedEvent } from '../../chat/chat-events';
import {
  TASK_CREATED,
  TASK_DELETED,
  TASK_MOVED,
  TASK_UPDATED,
  TaskCreatedEvent,
  TaskDeletedEvent,
  TaskEventBase,
  TaskMovedEvent,
  TaskUpdatedEvent,
} from '../../tasks/task-events';
import { WHITEBOARD_UPDATED, WhiteboardUpdatedEvent } from '../../whiteboards/whiteboard-events';
import { WebhookDeliveryService } from './webhook-delivery.service';

/**
 * Turns the domain events into deliveries. A failure never reaches the request
 * that produced the event: it only goes to the log and to the delivery row.
 */
@Injectable()
export class OutgoingWebhooksListener {
  private readonly logger = new Logger(OutgoingWebhooksListener.name);

  constructor(private readonly deliveries: WebhookDeliveryService) {}

  @OnEvent(TASK_CREATED)
  onTaskCreated(event: TaskCreatedEvent): void {
    this.send(event.workspaceId, 'task.created', taskPayload(event));
  }

  @OnEvent(TASK_UPDATED)
  onTaskUpdated(event: TaskUpdatedEvent): void {
    this.send(event.workspaceId, 'task.updated', {
      ...taskPayload(event),
      changes: event.changes,
    });
  }

  @OnEvent(TASK_MOVED)
  onTaskMoved(event: TaskMovedEvent): void {
    this.send(event.workspaceId, 'task.moved', {
      ...taskPayload(event),
      fromListId: String(event.fromListId),
      toListId: String(event.toListId),
    });
  }

  @OnEvent(TASK_DELETED)
  onTaskDeleted(event: TaskDeletedEvent): void {
    this.send(event.workspaceId, 'task.deleted', taskPayload(event));
  }

  @OnEvent(COMMENT_CREATED)
  onCommentCreated(event: CommentCreatedEvent): void {
    this.send(event.workspaceId, 'comment.created', {
      commentId: String(event.commentId),
      entityType: event.entityType,
      entityId: String(event.entityId),
      taskId: event.taskId ? String(event.taskId) : null,
      actorId: String(event.actorId),
    });
  }

  @OnEvent(MESSAGE_CREATED)
  onMessageCreated(event: MessageCreatedEvent): void {
    this.send(event.workspaceId, 'message.created', {
      channelId: String(event.channelId),
      messageId: String(event.messageId),
      authorId: String(event.authorId),
      preview: event.preview,
    });
  }

  @OnEvent(WHITEBOARD_UPDATED)
  onWhiteboardUpdated(event: WhiteboardUpdatedEvent): void {
    this.send(event.workspaceId, 'whiteboard.updated', {
      whiteboardId: String(event.whiteboardId),
      version: event.version,
      actorId: String(event.actorId),
      ops: event.ops,
    });
  }

  private send(workspaceId: Types.ObjectId, event: string, payload: Record<string, unknown>): void {
    void this.deliveries.enqueue(workspaceId, event, payload).catch((error: unknown) => {
      this.logger.error(
        `Falha ao enfileirar o webhook de ${event}.`,
        error instanceof Error ? error.stack : String(error),
      );
    });
  }
}

function taskPayload(event: TaskEventBase): Record<string, unknown> {
  return {
    taskId: String(event.taskId),
    customId: event.customId,
    listId: String(event.listId),
    actorId: String(event.actorId),
  };
}
