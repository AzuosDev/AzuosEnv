import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { OnEvent } from '@nestjs/event-emitter';
import {
  COMMENT_CREATED,
  COMMENT_UPDATED,
  CommentCreatedEvent,
  CommentUpdatedEvent,
} from '../collaboration/collaboration-events';
import {
  CHANNEL_READ,
  CHANNEL_DELIVERED,
  MESSAGE_CREATED,
  MESSAGE_DELETED,
  MESSAGE_UPDATED,
  ChannelReadEvent,
  ChannelDeliveredEvent,
  MessageCreatedEvent,
  MessageDeletedEvent,
  MessageEventBase,
  MessageUpdatedEvent,
} from '../chat/chat-events';
import {
  PAGE_COMMENTED,
  PAGE_CREATED,
  PAGE_UPDATED,
  PageCommentedEvent,
  PageCreatedEvent,
  PageEventBase,
  PageUpdatedEvent,
} from '../docs/docs-events';
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
import {
  WA_CONVERSATION_UPDATED,
  WA_MESSAGE_CREATED,
  WA_MESSAGE_STATUS,
  WaConversationUpdatedEvent,
  WaMessageCreatedEvent,
  WaMessageStatusEvent,
} from '../whatsapp/whatsapp-events';
import {
  WHITEBOARD_CREATED,
  WHITEBOARD_DELETED,
  WHITEBOARD_UPDATED,
  WhiteboardCreatedEvent,
  WhiteboardDeletedEvent,
  WhiteboardEventBase,
  WhiteboardUpdatedEvent,
} from '../whiteboards/whiteboard-events';
import { roomName, userRoom } from './realtime-rooms';
import { RealtimeService } from './realtime.service';

/**
 * Leva os eventos de domínio aos canais que os assistem, pelo transporte do
 * deploy (gateway Socket.IO ou Ably). Cada handler devolve a promessa da
 * publicação: em serverless o envio precisa terminar dentro do request, então
 * quem emite com `emitAsync` espera por ela.
 */
@Injectable()
export class RealtimeListener {
  constructor(private readonly realtime: RealtimeService) {}

  @OnEvent(TASK_CREATED)
  async onTaskCreated(event: TaskCreatedEvent): Promise<void> {
    await this.realtime.publish(taskRooms(event), 'task.created', taskPayload(event));
  }

  @OnEvent(TASK_UPDATED)
  async onTaskUpdated(event: TaskUpdatedEvent): Promise<void> {
    await this.realtime.publish(taskRooms(event), 'task.updated', {
      ...taskPayload(event),
      changes: event.changes,
    });
  }

  @OnEvent(TASK_MOVED)
  async onTaskMoved(event: TaskMovedEvent): Promise<void> {
    await this.realtime.publish(
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
  async onTaskDeleted(event: TaskDeletedEvent): Promise<void> {
    await this.realtime.publish(taskRooms(event), 'task.deleted', taskPayload(event));
  }

  @OnEvent(COMMENT_CREATED)
  async onCommentCreated(event: CommentCreatedEvent): Promise<void> {
    await this.realtime.publish(commentRooms(event), 'comment.created', commentPayload(event));
  }

  @OnEvent(COMMENT_UPDATED)
  async onCommentUpdated(event: CommentUpdatedEvent): Promise<void> {
    await this.realtime.publish(commentRooms(event), 'comment.updated', {
      ...commentPayload(event),
      changes: event.changes,
    });
  }

  @OnEvent(PAGE_CREATED)
  async onPageCreated(event: PageCreatedEvent): Promise<void> {
    await this.realtime.publish(pageRooms(event), 'page.created', pagePayload(event));
  }

  @OnEvent(PAGE_UPDATED)
  async onPageUpdated(event: PageUpdatedEvent): Promise<void> {
    await this.realtime.publish(pageRooms(event), 'page.updated', {
      ...pagePayload(event),
      changes: event.changes,
    });
  }

  @OnEvent(PAGE_COMMENTED)
  async onPageCommented(event: PageCommentedEvent): Promise<void> {
    await this.realtime.publish(pageRooms(event), 'page.commented', {
      ...pagePayload(event),
      commentId: String(event.commentId),
      anchor: event.anchor,
    });
  }

  @OnEvent(MESSAGE_CREATED)
  async onMessageCreated(event: MessageCreatedEvent): Promise<void> {
    await Promise.all([
      this.realtime.publish(messageRooms(event), 'message.new', messagePayload(event)),
      this.realtime.publish(activityRooms(event), 'channel.activity', messagePayload(event)),
    ]);
  }

  @OnEvent(MESSAGE_UPDATED)
  async onMessageUpdated(event: MessageUpdatedEvent): Promise<void> {
    await this.realtime.publish(messageRooms(event), 'message.updated', {
      ...messagePayload(event),
      changes: event.changes,
    });
  }

  @OnEvent(MESSAGE_DELETED)
  async onMessageDeleted(event: MessageDeletedEvent): Promise<void> {
    await this.realtime.publish(messageRooms(event), 'message.deleted', messagePayload(event));
  }

  @OnEvent(CHANNEL_READ)
  async onChannelRead(event: ChannelReadEvent): Promise<void> {
    await this.realtime.publish([roomName('channel', String(event.channelId))], 'channel.read', {
      workspaceId: String(event.workspaceId),
      channelId: String(event.channelId),
      userId: String(event.userId),
      lastReadAt: event.lastReadAt.toISOString(),
    });
  }

  @OnEvent(CHANNEL_DELIVERED)
  async onChannelDelivered(event: ChannelDeliveredEvent): Promise<void> {
    await this.realtime.publish(
      [roomName('channel', String(event.channelId))],
      'channel.delivered',
      {
        workspaceId: String(event.workspaceId),
        channelId: String(event.channelId),
        userId: String(event.userId),
        lastDeliveredAt: event.lastDeliveredAt.toISOString(),
      },
    );
  }

  @OnEvent(WHITEBOARD_CREATED)
  async onWhiteboardCreated(event: WhiteboardCreatedEvent): Promise<void> {
    await this.realtime.publish(boardRooms(event), 'whiteboard.created', boardPayload(event));
  }

  @OnEvent(WHITEBOARD_UPDATED)
  async onWhiteboardUpdated(event: WhiteboardUpdatedEvent): Promise<void> {
    await this.realtime.publish(boardRooms(event), 'whiteboard.updated', {
      ...boardPayload(event),
      ops: event.ops,
    });
  }

  @OnEvent(WHITEBOARD_DELETED)
  async onWhiteboardDeleted(event: WhiteboardDeletedEvent): Promise<void> {
    await this.realtime.publish(boardRooms(event), 'whiteboard.deleted', boardPayload(event));
  }

  @OnEvent(WA_MESSAGE_CREATED)
  async onWaMessageCreated(event: WaMessageCreatedEvent): Promise<void> {
    await this.realtime.publish(whatsappRooms(event.workspaceId), 'message.new', {
      workspaceId: String(event.workspaceId),
      conversationId: String(event.conversationId),
      messageId: String(event.messageId),
      direction: event.direction,
      type: event.type,
      preview: event.preview,
      authorId: event.authorId ? String(event.authorId) : null,
    });
  }

  @OnEvent(WA_MESSAGE_STATUS)
  async onWaMessageStatus(event: WaMessageStatusEvent): Promise<void> {
    await this.realtime.publish(whatsappRooms(event.workspaceId), 'message.status', {
      workspaceId: String(event.workspaceId),
      conversationId: String(event.conversationId),
      messageId: String(event.messageId),
      status: event.status,
      error: event.error,
    });
  }

  @OnEvent(WA_CONVERSATION_UPDATED)
  async onWaConversationUpdated(event: WaConversationUpdatedEvent): Promise<void> {
    await this.realtime.publish(whatsappRooms(event.workspaceId), 'conversation.updated', {
      workspaceId: String(event.workspaceId),
      conversationId: String(event.conversationId),
      status: event.status,
      assigneeId: event.assigneeId ? String(event.assigneeId) : null,
      unreadCount: event.unreadCount,
    });
  }

  @OnEvent(NOTIFICATION_CREATED)
  async onNotificationCreated(event: NotificationCreatedEvent): Promise<void> {
    await this.realtime.publish([userRoom(String(event.userId))], 'notification.new', {
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

function whatsappRooms(workspaceId: Types.ObjectId): string[] {
  return [roomName('whatsapp', String(workspaceId))];
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

function pageRooms(event: PageEventBase): string[] {
  return [roomName('ws', String(event.workspaceId)), roomName('doc', String(event.docId))];
}

function pagePayload(event: PageEventBase): Record<string, unknown> {
  return {
    workspaceId: String(event.workspaceId),
    docId: String(event.docId),
    pageId: String(event.pageId),
    parentPageId: event.parentPageId ? String(event.parentPageId) : null,
    version: event.version,
    actorId: String(event.actorId),
  };
}

function boardRooms(event: WhiteboardEventBase): string[] {
  return [roomName('ws', String(event.workspaceId)), roomName('board', String(event.whiteboardId))];
}

function boardPayload(event: WhiteboardEventBase): Record<string, unknown> {
  return {
    workspaceId: String(event.workspaceId),
    whiteboardId: String(event.whiteboardId),
    version: event.version,
    actorId: String(event.actorId),
  };
}

function messageRooms(event: MessageEventBase): string[] {
  return [roomName('channel', String(event.channelId))];
}

/**
 * Onde o resumo da mensagem nova chega para quem está fora do Chat. DM, grupo e
 * canal privado têm lista de membros, então cada um recebe na própria sala — e
 * o autor não precisa de aviso do que ele mesmo escreveu. Canal aberto não tem
 * lista: o resumo vai na sala do workspace, que toda aba assina, e a aba
 * descarta o que veio dela mesma.
 */
function activityRooms(event: MessageEventBase): string[] {
  if (event.channelPrivate || event.channelType !== 'channel') {
    return event.memberIds
      .filter((memberId) => !memberId.equals(event.authorId))
      .map((memberId) => userRoom(String(memberId)));
  }

  return [roomName('ws', String(event.workspaceId))];
}

function messagePayload(event: MessageEventBase): Record<string, unknown> {
  return {
    workspaceId: String(event.workspaceId),
    channelId: String(event.channelId),
    channelType: event.channelType,
    channelName: event.channelName,
    messageId: String(event.messageId),
    parentMessageId: event.parentMessageId ? String(event.parentMessageId) : null,
    authorId: String(event.authorId),
    mentions: event.mentions.map(String),
    preview: event.preview,
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
