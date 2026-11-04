import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MESSAGE_CREATED, MessageCreatedEvent } from '../chat/chat-events';
import {
  COMMENT_CREATED,
  COMMENT_UPDATED,
  CommentCreatedEvent,
  CommentUpdatedEvent,
} from '../collaboration/collaboration-events';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';
import {
  TASK_CREATED,
  TASK_UPDATED,
  TaskChanges,
  TaskCreatedEvent,
  TaskUpdatedEvent,
} from '../tasks/task-events';
import { MEMBER_INVITED, MemberInvitedEvent } from '../workspaces/workspace-events';
import { NotificationRecipient, NotificationsService } from './notifications.service';

/** Turns the domain events into inbox entries for assignees, watchers and mentions. */
@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    @InjectModel(Task.name) private readonly tasks: Model<Task>,
    private readonly notifications: NotificationsService,
  ) {}

  @OnEvent(TASK_CREATED)
  async onTaskCreated(event: TaskCreatedEvent): Promise<void> {
    const task = await this.loadTask(event.taskId);

    if (!task) {
      return;
    }

    await this.safeDeliver(() =>
      this.notifications.deliver({
        workspaceId: event.workspaceId,
        type: 'assigned',
        entityType: 'task',
        entityId: task._id,
        actorId: event.actorId,
        recipients: primary(task.assigneeIds),
        data: taskData(task),
        mail: taskMail('Você foi atribuído a uma tarefa', task),
      }),
    );
  }

  @OnEvent(TASK_UPDATED)
  async onTaskUpdated(event: TaskUpdatedEvent): Promise<void> {
    const task = await this.loadTask(event.taskId);

    if (!task) {
      return;
    }

    const added = addedIds(event.changes, 'assigneeIds');

    if (added.length > 0) {
      await this.safeDeliver(() =>
        this.notifications.deliver({
          workspaceId: event.workspaceId,
          type: 'assigned',
          entityType: 'task',
          entityId: task._id,
          actorId: event.actorId,
          recipients: primary(added),
          data: taskData(task),
          mail: taskMail('Você foi atribuído a uma tarefa', task),
        }),
      );
    }

    if (event.changes.statusId) {
      await this.safeDeliver(() =>
        this.notifications.deliver({
          workspaceId: event.workspaceId,
          type: 'statusChanged',
          entityType: 'task',
          entityId: task._id,
          actorId: event.actorId,
          recipients: [...primary(task.assigneeIds), ...other(task.watcherIds)],
          data: { ...taskData(task), statusId: String(task.statusId) },
          mail: taskMail('O status de uma tarefa mudou', task),
        }),
      );
    }
  }

  @OnEvent(COMMENT_CREATED)
  async onCommentCreated(event: CommentCreatedEvent): Promise<void> {
    const task = event.taskId ? await this.loadTask(event.taskId) : null;

    if (!task) {
      return;
    }

    const data = { ...taskData(task), commentId: String(event.commentId) };

    await this.safeDeliver(() =>
      this.notifications.deliver({
        workspaceId: event.workspaceId,
        type: 'mentioned',
        entityType: 'comment',
        entityId: event.commentId,
        actorId: event.actorId,
        recipients: primary(event.mentions),
        data,
        mail: taskMail('Você foi mencionado em um comentário', task),
      }),
    );

    const assigneeId = event.assigneeId;

    if (assigneeId) {
      await this.safeDeliver(() =>
        this.notifications.deliver({
          workspaceId: event.workspaceId,
          type: 'commentAssigned',
          entityType: 'comment',
          entityId: event.commentId,
          actorId: event.actorId,
          recipients: primary([assigneeId]),
          data,
          mail: taskMail('Um comentário foi atribuído a você', task),
        }),
      );
    }

    const mentioned = new Set(event.mentions.map((id) => String(id)));
    const rest = (ids: Types.ObjectId[]): Types.ObjectId[] =>
      ids.filter((id) => !mentioned.has(String(id)) && String(id) !== String(event.assigneeId));

    await this.safeDeliver(() =>
      this.notifications.deliver({
        workspaceId: event.workspaceId,
        type: 'commented',
        entityType: 'comment',
        entityId: event.commentId,
        actorId: event.actorId,
        recipients: [...primary(rest(task.assigneeIds)), ...other(rest(task.watcherIds))],
        data,
        mail: taskMail('Novo comentário em uma tarefa', task),
      }),
    );
  }

  @OnEvent(COMMENT_UPDATED)
  async onCommentUpdated(event: CommentUpdatedEvent): Promise<void> {
    const assigned = event.changes.assigneeId;
    const task = event.taskId ? await this.loadTask(event.taskId) : null;

    if (!task || !assigned || typeof assigned.to !== 'string') {
      return;
    }

    await this.safeDeliver(() =>
      this.notifications.deliver({
        workspaceId: event.workspaceId,
        type: 'commentAssigned',
        entityType: 'comment',
        entityId: event.commentId,
        actorId: event.actorId,
        recipients: primary([new Types.ObjectId(assigned.to as string)]),
        data: { ...taskData(task), commentId: String(event.commentId) },
        mail: taskMail('Um comentário foi atribuído a você', task),
      }),
    );
  }

  @OnEvent(MEMBER_INVITED)
  async onMemberInvited(event: MemberInvitedEvent): Promise<void> {
    await this.safeDeliver(() =>
      this.notifications.deliver({
        workspaceId: event.workspaceId,
        type: 'invited',
        entityType: 'workspace',
        entityId: event.workspaceId,
        actorId: event.actorId,
        recipients: primary([event.userId]),
        data: { workspaceName: event.workspaceName, role: event.role, acceptUrl: event.acceptUrl },
      }),
    );
  }

  private loadTask(taskId: Types.ObjectId): Promise<TaskDocument | null> {
    return this.tasks.findById(taskId).exec();
  }

  /** A notification must never break the request that emitted the event. */
  private async safeDeliver(deliver: () => Promise<unknown>): Promise<void> {
    try {
      await deliver();
    } catch (error) {
      this.logger.error(
        'Falha ao gerar notificação',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Chat: a mention always notifies and a direct message notifies the other side.
   * The payload of the event carries everything, so the channel is not reloaded.
   */
  @OnEvent(MESSAGE_CREATED)
  async onMessageCreated(event: MessageCreatedEvent): Promise<void> {
    const data = {
      channelId: String(event.channelId),
      channelType: event.channelType,
      channelName: event.channelName,
      messageId: String(event.messageId),
      preview: event.preview,
    };
    const mentioned = event.mentions.filter((userId) => String(userId) !== String(event.authorId));

    if (mentioned.length > 0) {
      await this.safeDeliver(() =>
        this.notifications.deliver({
          workspaceId: event.workspaceId,
          type: 'chatMention',
          entityType: 'message',
          entityId: event.messageId,
          actorId: event.authorId,
          recipients: primary(mentioned),
          data,
          mail: chatMail('Você foi mencionado no chat', event),
        }),
      );
    }

    if (event.channelType !== 'dm') {
      return;
    }

    const alreadyNotified = new Set(mentioned.map(String));
    const others = event.memberIds.filter(
      (userId) => String(userId) !== String(event.authorId) && !alreadyNotified.has(String(userId)),
    );

    if (others.length === 0) {
      return;
    }

    await this.safeDeliver(() =>
      this.notifications.deliver({
        workspaceId: event.workspaceId,
        type: 'chatMessage',
        entityType: 'message',
        entityId: event.messageId,
        actorId: event.authorId,
        recipients: primary(others),
        data,
        mail: chatMail('Nova mensagem direta', event),
      }),
    );
  }
}

function primary(ids: Types.ObjectId[]): NotificationRecipient[] {
  return ids.map((userId) => ({ userId, bucket: 'primary' as const }));
}

function other(ids: Types.ObjectId[]): NotificationRecipient[] {
  return ids.map((userId) => ({ userId, bucket: 'other' as const }));
}

/** Ids present in `to` and absent from `from`; the diff normalizes both to strings. */
function addedIds(changes: TaskChanges, field: string): Types.ObjectId[] {
  const change = changes[field];

  if (!change || !Array.isArray(change.to)) {
    return [];
  }

  const before = new Set((Array.isArray(change.from) ? change.from : []).map(String));

  return change.to
    .filter((id): id is string => typeof id === 'string' && !before.has(id))
    .map((id) => new Types.ObjectId(id));
}

function taskData(task: TaskDocument): Record<string, unknown> {
  return {
    taskId: String(task._id),
    customId: task.customId,
    name: task.name,
    listId: String(task.listId),
  };
}

function taskMail(subject: string, task: TaskDocument): { subject: string; text: string } {
  return { subject: `${subject}: ${task.customId}`, text: `${task.customId} — ${task.name}` };
}

function chatMail(subject: string, event: MessageCreatedEvent): { subject: string; text: string } {
  const where = event.channelType === 'dm' ? 'conversa direta' : `canal ${event.channelName}`;

  return { subject, text: `${where}: ${event.preview}` };
}
