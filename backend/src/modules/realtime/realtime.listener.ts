import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  COMMENT_CREATED,
  COMMENT_UPDATED,
  CommentCreatedEvent,
  CommentUpdatedEvent,
} from '../collaboration/collaboration-events';
import {
  NOTIFICATION_CREATED,
  NotificationCreatedEvent,
} from '../notifications/notification-events';
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
} from '../tasks/task-events';
import { EventsGateway } from './events.gateway';
import { roomName, userRoom } from './realtime-rooms';

/** Relays the domain events to the Socket.IO rooms that watch them. */
@Injectable()
export class RealtimeListener {
  constructor(private readonly gateway: EventsGateway) {}

  @OnEvent(TASK_CREATED)
  onTaskCreated(event: TaskCreatedEvent): void {
    this.gateway.emitToRooms(taskRooms(event), 'task.created', taskPayload(event));
  }

  @OnEvent(TASK_UPDATED)
  onTaskUpdated(event: TaskUpdatedEvent): void {
    this.gateway.emitToRooms(taskRooms(event), 'task.updated', {
      ...taskPayload(event),
      changes: event.changes,
    });
  }

  @OnEvent(TASK_MOVED)
  onTaskMoved(event: TaskMovedEvent): void {
    this.gateway.emitToRooms(
      [...taskRooms(event), roomName('list', String(event.fromListId))],
      'task.moved',
      {
        ...taskPayload(event),
        fromListId: String(event.fromListId),
        toListId: String(event.toListId),
      },
    );
  }

  @OnEvent(TASK_DELETED)
  onTaskDeleted(event: TaskDeletedEvent): void {
    this.gateway.emitToRooms(taskRooms(event), 'task.deleted', taskPayload(event));
  }

  @OnEvent(COMMENT_CREATED)
  onCommentCreated(event: CommentCreatedEvent): void {
    this.gateway.emitToRooms(commentRooms(event), 'comment.created', commentPayload(event));
  }

  @OnEvent(COMMENT_UPDATED)
  onCommentUpdated(event: CommentUpdatedEvent): void {
    this.gateway.emitToRooms(commentRooms(event), 'comment.updated', {
      ...commentPayload(event),
      changes: event.changes,
    });
  }

  @OnEvent(NOTIFICATION_CREATED)
  onNotificationCreated(event: NotificationCreatedEvent): void {
    this.gateway.emitToRooms([userRoom(String(event.userId))], 'notification.new', {
      id: String(event.notificationId),
      workspaceId: String(event.workspaceId),
      type: event.type,
      bucket: event.bucket,
      entityType: event.entityType,
      entityId: String(event.entityId),
      actorId: event.actorId ? String(event.actorId) : null,
      data: event.data,
    });
  }
}

function taskRooms(event: TaskEventBase): string[] {
  return [
    roomName('ws', String(event.workspaceId)),
    roomName('list', String(event.listId)),
    roomName('task', String(event.taskId)),
  ];
}

function taskPayload(event: TaskEventBase): Record<string, unknown> {
  return {
    workspaceId: String(event.workspaceId),
    taskId: String(event.taskId),
    customId: event.customId,
    listId: String(event.listId),
    actorId: String(event.actorId),
  };
}

function commentRooms(event: CommentCreatedEvent): string[] {
  const rooms = [roomName('ws', String(event.workspaceId))];

  if (event.taskId) {
    rooms.push(roomName('task', String(event.taskId)));
  }

  if (event.listId) {
    rooms.push(roomName('list', String(event.listId)));
  }

  return rooms;
}

function commentPayload(event: CommentCreatedEvent): Record<string, unknown> {
  return {
    workspaceId: String(event.workspaceId),
    commentId: String(event.commentId),
    entityType: event.entityType,
    entityId: String(event.entityId),
    parentCommentId: event.parentCommentId ? String(event.parentCommentId) : null,
    taskId: event.taskId ? String(event.taskId) : null,
    listId: event.listId ? String(event.listId) : null,
    actorId: String(event.actorId),
  };
}
