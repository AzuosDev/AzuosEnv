import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage, buildCursorPage, decodeObjectIdCursor } from '../../common/pagination/cursor';
import {
  DEFAULT_PAGE_SIZE,
  PaginationQueryDto,
} from '../../common/pagination/pagination-query.dto';
import { extractMentions } from '../collaboration/mentions';
import { Attachment } from '../collaboration/schemas/attachment.schema';
import { PermissionContext } from '../hierarchy/permission.service';
import { TaskDocument } from '../tasks/schemas/task.schema';
import { TaskChanges } from '../tasks/task-events';
import { recordChange } from '../tasks/task-diff';
import { TasksService } from '../tasks/tasks.service';
import { hasRoleAtLeast } from '../workspaces/workspace-roles';
import { MembersService } from '../workspaces/members.service';
import { ChatAccessService } from './chat-access.service';
import {
  MESSAGE_CREATED,
  MESSAGE_DELETED,
  MESSAGE_UPDATED,
  MessageCreatedEvent,
  MessageDeletedEvent,
  MessageEventBase,
  MessageUpdatedEvent,
} from './chat-events';
import { MAX_TASK_NAME_FROM_MESSAGE } from './chat-fields';
import {
  CreateMessageDto,
  MessageReactionDto,
  MessageToTaskDto,
  UpdateMessageDto,
} from './dto/message.dto';
import { ChannelDocument } from './schemas/channel.schema';
import { Message, MessageDocument } from './schemas/message.schema';

/** Preview of the message carried by the events and by the inbox. */
const PREVIEW_LENGTH = 200;

export interface MessageToTaskResult {
  task: TaskDocument;
  /** Deep link of the message that originated the task. */
  messageUrl: string;
}

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name) private readonly model: Model<Message>,
    @InjectModel(Attachment.name) private readonly attachments: Model<Attachment>,
    private readonly access: ChatAccessService,
    private readonly members: MembersService,
    private readonly tasks: TasksService,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
  ) {}

  async create(
    ctx: PermissionContext,
    channelId: Types.ObjectId,
    dto: CreateMessageDto,
  ): Promise<MessageDocument> {
    const channel = await this.access.requireChannel(ctx, channelId, 'comment');

    this.access.requireMembership(ctx, channel);

    const parent = dto.parentMessageId
      ? await this.requireParent(channel, new Types.ObjectId(dto.parentMessageId))
      : null;
    const message = await this.model.create({
      workspaceId: channel.workspaceId,
      channelId: channel._id,
      authorId: ctx.userId,
      body: dto.body ?? null,
      bodyText: dto.bodyText,
      parentMessageId: parent?._id ?? null,
      mentions: await this.resolveMentions(ctx, dto.body),
      attachmentIds: await this.resolveAttachments(ctx, dto.attachmentIds),
    });

    if (parent) {
      parent.replyCount += 1;
      parent.lastReplyAt = new Date();
      await parent.save();
    }

    this.events.emit(
      MESSAGE_CREATED,
      this.baseEvent(channel, message) satisfies MessageCreatedEvent,
    );

    return message;
  }

  /** Root messages of the channel, newest first. */
  async list(
    ctx: PermissionContext,
    channelId: Types.ObjectId,
    query: PaginationQueryDto,
  ): Promise<CursorPage<MessageDocument>> {
    const channel = await this.access.requireChannel(ctx, channelId, 'view');
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const base = {
      workspaceId: channel.workspaceId,
      channelId: channel._id,
      parentMessageId: null,
      deletedAt: null,
    };
    const docs = await this.model
      .find(query.cursor ? { ...base, _id: { $lt: decodeObjectIdCursor(query.cursor) } } : base)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .exec();

    return buildCursorPage(docs, limit, (doc) => ({ id: String(doc._id) }));
  }

  /** Replies of a thread, oldest first. */
  async listReplies(
    ctx: PermissionContext,
    messageId: Types.ObjectId,
    query: PaginationQueryDto,
  ): Promise<CursorPage<MessageDocument>> {
    const { message } = await this.access.requireMessage(ctx, messageId, 'view');
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const root = message.parentMessageId ?? message._id;
    const base = { workspaceId: message.workspaceId, parentMessageId: root, deletedAt: null };
    const docs = await this.model
      .find(query.cursor ? { ...base, _id: { $gt: decodeObjectIdCursor(query.cursor) } } : base)
      .sort({ _id: 1 })
      .limit(limit + 1)
      .exec();

    return buildCursorPage(docs, limit, (doc) => ({ id: String(doc._id) }));
  }

  /** Only the author edits a message. */
  async update(
    ctx: PermissionContext,
    messageId: Types.ObjectId,
    dto: UpdateMessageDto,
  ): Promise<MessageDocument> {
    const { message, channel } = await this.access.requireMessage(ctx, messageId, 'comment');

    this.requireAuthor(ctx, message);

    const changes: TaskChanges = {};

    if (dto.bodyText !== undefined) {
      recordChange(changes, 'bodyText', message.bodyText, dto.bodyText);
      message.bodyText = dto.bodyText;
    }

    if (dto.body !== undefined) {
      recordChange(changes, 'body', message.body, dto.body);
      message.body = dto.body;
      message.mentions = await this.resolveMentions(ctx, dto.body);
    }

    if (dto.attachmentIds !== undefined) {
      message.attachmentIds = await this.resolveAttachments(ctx, dto.attachmentIds);
      recordChange(changes, 'attachmentIds', null, message.attachmentIds.map(String));
    }

    if (Object.keys(changes).length === 0) {
      return message;
    }

    message.editedAt = new Date();
    await message.save();

    this.events.emit(MESSAGE_UPDATED, {
      ...this.baseEvent(channel, message),
      changes,
    } satisfies MessageUpdatedEvent);

    return message;
  }

  /** Soft delete; the author or an admin of the workspace removes a message. */
  async remove(ctx: PermissionContext, messageId: Types.ObjectId): Promise<void> {
    const { message, channel } = await this.access.requireMessage(ctx, messageId, 'comment');

    if (!hasRoleAtLeast(ctx.role, 'admin')) {
      this.requireAuthor(ctx, message);
    }

    message.deletedAt = new Date();
    await message.save();

    this.events.emit(
      MESSAGE_DELETED,
      this.baseEvent(channel, message) satisfies MessageDeletedEvent,
    );
  }

  /** Reacting again with the same emoji removes the reaction. */
  async react(
    ctx: PermissionContext,
    messageId: Types.ObjectId,
    dto: MessageReactionDto,
  ): Promise<MessageDocument> {
    const { message, channel } = await this.access.requireMessage(ctx, messageId, 'comment');

    this.access.requireMembership(ctx, channel);

    const reaction = message.reactions.find((candidate) => candidate.emoji === dto.emoji);

    if (!reaction) {
      message.reactions.push({ emoji: dto.emoji, userIds: [ctx.userId] });

      return message.save();
    }

    const reacted = reaction.userIds.some((userId) => String(userId) === String(ctx.userId));

    reaction.userIds = reacted
      ? reaction.userIds.filter((userId) => String(userId) !== String(ctx.userId))
      : [...reaction.userIds, ctx.userId];

    message.reactions = message.reactions.filter((candidate) => candidate.userIds.length > 0);

    return message.save();
  }

  /** Turns the message into a task of `listId`, linking back to the conversation. */
  async toTask(
    ctx: PermissionContext,
    messageId: Types.ObjectId,
    taskPrefix: string,
    dto: MessageToTaskDto,
  ): Promise<MessageToTaskResult> {
    const { message, channel } = await this.access.requireMessage(ctx, messageId, 'view');
    const messageUrl = this.messageUrl(channel, message);
    const task = await this.tasks.create(ctx, new Types.ObjectId(dto.listId), taskPrefix, {
      name: taskNameOf(message),
      descriptionText: `Mensagem do chat: ${messageUrl}`,
    });

    return { task, messageUrl };
  }

  private requireAuthor(ctx: PermissionContext, message: MessageDocument): void {
    if (String(message.authorId) !== String(ctx.userId)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_MESSAGE',
        message: 'Somente quem escreveu pode alterar a mensagem.',
      });
    }
  }

  /** The parent must belong to the same channel and be the root of its thread. */
  private async requireParent(
    channel: ChannelDocument,
    parentMessageId: Types.ObjectId,
  ): Promise<MessageDocument> {
    const parent = await this.model
      .findOne({
        _id: parentMessageId,
        workspaceId: channel.workspaceId,
        channelId: channel._id,
        parentMessageId: null,
        deletedAt: null,
      })
      .exec();

    if (!parent) {
      throw new BadRequestException({
        code: 'INVALID_MESSAGE_PARENT',
        message: 'A mensagem raiz não pertence a este canal.',
      });
    }

    return parent;
  }

  /** Mentions of active members only; anyone else is dropped in silence. */
  private async resolveMentions(
    ctx: PermissionContext,
    body: Record<string, unknown> | null | undefined,
  ): Promise<Types.ObjectId[]> {
    const mentioned = extractMentions(body ?? null);

    if (mentioned.length === 0) {
      return [];
    }

    return this.members.activeUserIds(ctx.workspaceId, mentioned);
  }

  /** Attachments that really exist in the workspace; the rest is dropped. */
  private async resolveAttachments(
    ctx: PermissionContext,
    ids: string[] | undefined,
  ): Promise<Types.ObjectId[]> {
    if (!ids || ids.length === 0) {
      return [];
    }

    const docs = await this.attachments
      .find({
        workspaceId: ctx.workspaceId,
        _id: { $in: [...new Set(ids)].map((id) => new Types.ObjectId(id)) },
      })
      .select('_id')
      .exec();

    return docs.map((doc) => doc._id);
  }

  private messageUrl(channel: ChannelDocument, message: MessageDocument): string {
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:5173';

    return `${appUrl.replace(/\/+$/, '')}/chat/${String(channel._id)}?message=${String(message._id)}`;
  }

  private baseEvent(channel: ChannelDocument, message: MessageDocument): MessageEventBase {
    return {
      workspaceId: message.workspaceId,
      channelId: channel._id,
      channelType: channel.type,
      channelName: channel.name,
      messageId: message._id,
      parentMessageId: message.parentMessageId,
      authorId: message.authorId,
      mentions: message.mentions,
      memberIds: channel.memberIds,
      preview: message.bodyText.slice(0, PREVIEW_LENGTH),
    };
  }
}

/** First line of the message, trimmed to the length a task name accepts. */
function taskNameOf(message: MessageDocument): string {
  const first = message.bodyText.split('\n')[0]?.trim() ?? '';
  const name = first.slice(0, MAX_TASK_NAME_FROM_MESSAGE).trim();

  return name.length > 0 ? name : 'Mensagem do chat';
}
