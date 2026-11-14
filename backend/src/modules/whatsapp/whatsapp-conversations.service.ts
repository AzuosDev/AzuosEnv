import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage, buildCursorPage, decodeObjectIdCursor } from '../../common/pagination/cursor';
import { DEFAULT_PAGE_SIZE } from '../../common/pagination/pagination-query.dto';
import { escapeRegex } from '../../common/utils/regex';
import { PermissionContext } from '../hierarchy/permission.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkspaceMember } from '../workspaces/schemas/workspace-member.schema';
import {
  AssignWaConversationDto,
  WaConversationQueryDto,
  WaModeDto,
  WaPriorityDto,
} from './dto/whatsapp.dto';
import { WaContactDocument } from './schemas/wa-contact.schema';
import { WaConversation, WaConversationDocument } from './schemas/wa-conversation.schema';
import { WaMessage } from './schemas/wa-message.schema';
import { WhatsappAccessService } from './whatsapp-access.service';
import { WhatsappContactsService } from './whatsapp-contacts.service';
import { WA_CONVERSATION_UPDATED, WaConversationUpdatedEvent } from './whatsapp-events';
import { MAX_WA_SCAN, WaAccessLevel, hasWaLevelAtLeast } from './whatsapp-fields';

/**
 * Conversations of the module. An `atendente` only reaches what is assigned to
 * them plus the queue with no owner; `supervisor` and above reach everything.
 */
@Injectable()
export class WhatsappConversationsService {
  private readonly logger = new Logger(WhatsappConversationsService.name);

  constructor(
    @InjectModel(WaConversation.name) private readonly model: Model<WaConversation>,
    @InjectModel(WaMessage.name) private readonly messages: Model<WaMessage>,
    @InjectModel(WorkspaceMember.name) private readonly members: Model<WorkspaceMember>,
    private readonly access: WhatsappAccessService,
    private readonly contacts: WhatsappContactsService,
    private readonly notifications: NotificationsService,
    private readonly events: EventEmitter2,
  ) {}

  conversationNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'WHATSAPP_CONVERSATION_NOT_FOUND',
      message: 'Conversa não encontrada.',
    });
  }

  async list(
    ctx: PermissionContext,
    level: WaAccessLevel,
    query: WaConversationQueryDto,
  ): Promise<CursorPage<WaConversationDocument>> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const filter: Record<string, unknown> = {
      workspaceId: ctx.workspaceId,
      ...this.scopeOf(ctx, level),
      ...this.filterOf(ctx, query.filter ?? 'open'),
      ...(await this.searchOf(ctx, query.q)),
    };

    if (query.cursor) {
      filter._id = { $lt: decodeObjectIdCursor(query.cursor) };
    }

    const docs = await this.model
      .find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .exec();

    return buildCursorPage(docs, limit, (doc) => ({ id: String(doc._id) }));
  }

  /** The conversation plus the level, enforcing the scope of the requester. */
  async require(
    ctx: PermissionContext,
    level: WaAccessLevel,
    conversationId: Types.ObjectId,
  ): Promise<WaConversationDocument> {
    const conversation = await this.model
      .findOne({
        _id: conversationId,
        workspaceId: ctx.workspaceId,
        ...this.scopeOf(ctx, level),
      })
      .exec();

    if (!conversation) {
      throw this.conversationNotFound();
    }

    return conversation;
  }

  async markRead(
    ctx: PermissionContext,
    level: WaAccessLevel,
    conversationId: Types.ObjectId,
  ): Promise<WaConversationDocument> {
    const conversation = await this.require(ctx, level, conversationId);

    conversation.unreadCount = 0;
    await conversation.save();
    this.emitUpdated(conversation);

    return conversation;
  }

  async assign(
    ctx: PermissionContext,
    level: WaAccessLevel,
    conversationId: Types.ObjectId,
    dto: AssignWaConversationDto,
  ): Promise<WaConversationDocument> {
    const conversation = await this.require(ctx, level, conversationId);
    const assigneeId = dto.assigneeId ? new Types.ObjectId(dto.assigneeId) : null;

    // An attendant only takes a conversation for themselves or gives it back.
    if (
      !hasWaLevelAtLeast(level, 'supervisor') &&
      assigneeId !== null &&
      String(assigneeId) !== String(ctx.userId)
    ) {
      throw new BadRequestException({
        code: 'WHATSAPP_ASSIGNEE_NOT_ALLOWED',
        message: 'Atendente só pode assumir a conversa para si.',
      });
    }

    if (assigneeId) {
      await this.requireMember(ctx, assigneeId);
    }

    const changed = String(conversation.assigneeId ?? '') !== String(assigneeId ?? '');

    conversation.assigneeId = assigneeId;

    if (assigneeId && conversation.status === 'closed') {
      conversation.status = 'open';
      conversation.closedAt = null;
      conversation.closedBy = null;
    }

    await conversation.save();
    this.emitUpdated(conversation);

    if (changed && assigneeId && String(assigneeId) !== String(ctx.userId)) {
      await this.notifyAssignee(conversation, assigneeId, ctx.userId);
    }

    return conversation;
  }

  async setPriority(
    ctx: PermissionContext,
    level: WaAccessLevel,
    conversationId: Types.ObjectId,
    dto: WaPriorityDto,
  ): Promise<WaConversationDocument> {
    const conversation = await this.require(ctx, level, conversationId);

    conversation.priority = dto.priority;
    await conversation.save();
    this.emitUpdated(conversation);

    return conversation;
  }

  async setMode(
    ctx: PermissionContext,
    level: WaAccessLevel,
    conversationId: Types.ObjectId,
    dto: WaModeDto,
  ): Promise<WaConversationDocument> {
    const conversation = await this.require(ctx, level, conversationId);

    conversation.mode = dto.mode;
    conversation.botPausedUntil = dto.botPausedUntil ? new Date(dto.botPausedUntil) : null;
    await conversation.save();
    this.emitUpdated(conversation);

    return conversation;
  }

  async close(
    ctx: PermissionContext,
    level: WaAccessLevel,
    conversationId: Types.ObjectId,
  ): Promise<WaConversationDocument> {
    const conversation = await this.require(ctx, level, conversationId);

    conversation.status = 'closed';
    conversation.closedAt = new Date();
    conversation.closedBy = ctx.userId;
    conversation.unreadCount = 0;
    await conversation.save();
    this.emitUpdated(conversation);

    return conversation;
  }

  async reopen(
    ctx: PermissionContext,
    level: WaAccessLevel,
    conversationId: Types.ObjectId,
  ): Promise<WaConversationDocument> {
    const conversation = await this.require(ctx, level, conversationId);

    conversation.status = 'open';
    conversation.closedAt = null;
    conversation.closedBy = null;
    await conversation.save();
    this.emitUpdated(conversation);

    return conversation;
  }

  /** Conversation of the contact that is not closed, created when there is none. */
  async openFor(
    workspaceId: Types.ObjectId,
    contact: WaContactDocument,
    at: Date,
  ): Promise<{ conversation: WaConversationDocument; created: boolean }> {
    const existing = await this.model
      .findOne({ workspaceId, contactId: contact._id, status: { $ne: 'closed' } })
      .sort({ _id: -1 })
      .exec();

    if (existing) {
      return { conversation: existing, created: false };
    }

    const conversation = await this.model.create({
      workspaceId,
      contactId: contact._id,
      status: 'open',
      lastMessageAt: at,
    });

    return { conversation, created: true };
  }

  /** Records an inbound message on the conversation and opens the 24 h window. */
  async touchInbound(conversation: WaConversationDocument, at: Date): Promise<void> {
    conversation.lastMessageAt = at;
    conversation.lastInboundAt = at;
    conversation.unreadCount += 1;

    if (conversation.status === 'closed') {
      conversation.status = 'open';
      conversation.closedAt = null;
      conversation.closedBy = null;
    }

    await conversation.save();
    this.emitUpdated(conversation);
  }

  /**
   * Records an outbound message; the conversation starts waiting for the answer.
   * `pauseMinutes` above zero is an attendant answering, which holds the bot back.
   */
  async touchOutbound(
    conversation: WaConversationDocument,
    at: Date,
    pauseMinutes = 0,
  ): Promise<void> {
    conversation.lastMessageAt = at;

    if (conversation.status !== 'closed') {
      conversation.status = 'waiting';
    }

    if (pauseMinutes > 0 && conversation.mode === 'bot') {
      conversation.botPausedUntil = new Date(at.getTime() + pauseMinutes * 60_000);
    }

    await conversation.save();
    this.emitUpdated(conversation);
  }

  emitUpdated(conversation: WaConversationDocument): void {
    this.events.emit(WA_CONVERSATION_UPDATED, {
      workspaceId: conversation.workspaceId,
      conversationId: conversation._id,
      status: conversation.status,
      assigneeId: conversation.assigneeId,
      unreadCount: conversation.unreadCount,
    } satisfies WaConversationUpdatedEvent);
  }

  /** Inbox entry for whoever answers the conversation. */
  async notifyAssignee(
    conversation: WaConversationDocument,
    assigneeId: Types.ObjectId,
    actorId: Types.ObjectId | null,
  ): Promise<void> {
    await this.deliver(conversation, [assigneeId], actorId, 'whatsappAssigned', 'atribuída a você');
  }

  /** New conversation in the queue: everyone who triages it is told. */
  async notifyNewConversation(conversation: WaConversationDocument): Promise<void> {
    const userIds = await this.access.userIdsAtLeast(conversation.workspaceId, 'supervisor');

    await this.deliver(conversation, userIds, null, 'whatsappMessage', 'nova conversa na fila');
  }

  /** Inbound message on a conversation that already has an owner. */
  async notifyInbound(conversation: WaConversationDocument, preview: string): Promise<void> {
    if (!conversation.assigneeId) {
      return;
    }

    await this.deliver(
      conversation,
      [conversation.assigneeId],
      null,
      'whatsappMessage',
      preview || 'nova mensagem',
    );
  }

  private async deliver(
    conversation: WaConversationDocument,
    userIds: Types.ObjectId[],
    actorId: Types.ObjectId | null,
    type: 'whatsappAssigned' | 'whatsappMessage',
    preview: string,
  ): Promise<void> {
    if (userIds.length === 0) {
      return;
    }

    try {
      await this.notifications.deliver({
        workspaceId: conversation.workspaceId,
        type,
        entityType: 'whatsappConversation',
        entityId: conversation._id,
        actorId,
        recipients: userIds.map((userId) => ({ userId, bucket: 'primary' as const })),
        data: { conversationId: String(conversation._id), preview },
        mail: { subject: 'WhatsApp no Azuos Env', text: `WhatsApp: ${preview}.` },
      });
    } catch (error) {
      this.logger.warn(
        `Não foi possível notificar a conversa ${String(conversation._id)}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** Part of the filter that hides what the level cannot reach. */
  private scopeOf(ctx: PermissionContext, level: WaAccessLevel): Record<string, unknown> {
    if (hasWaLevelAtLeast(level, 'supervisor')) {
      return {};
    }

    return { $and: [{ $or: [{ assigneeId: ctx.userId }, { assigneeId: null }] }] };
  }

  private filterOf(ctx: PermissionContext, filter: string): Record<string, unknown> {
    if (filter === 'all') {
      return {};
    }

    if (filter === 'closed') {
      return { status: 'closed' };
    }

    if (filter === 'unread') {
      return { status: { $ne: 'closed' }, unreadCount: { $gt: 0 } };
    }

    if (filter === 'waiting') {
      return { status: 'waiting' };
    }

    if (filter === 'mine') {
      return { status: { $ne: 'closed' }, assigneeId: ctx.userId };
    }

    if (filter === 'priority') {
      return { status: { $ne: 'closed' }, priority: { $ne: 'normal' } };
    }

    return { status: { $ne: 'closed' } };
  }

  /**
   * Search by name, number or message text. The contacts and the messages are
   * resolved first so the conversation query stays a single filter.
   */
  private async searchOf(
    ctx: PermissionContext,
    term: string | undefined,
  ): Promise<Record<string, unknown>> {
    const cleaned = (term ?? '').trim();

    if (cleaned.length === 0) {
      return {};
    }

    const matches = await this.messages
      .find({ workspaceId: ctx.workspaceId, body: new RegExp(escapeRegex(cleaned), 'i') })
      .select('conversationId')
      .limit(MAX_WA_SCAN)
      .exec();
    const contactIds = await this.contacts.idsMatching(ctx.workspaceId, cleaned);

    return {
      $or: [
        { contactId: { $in: contactIds } },
        { _id: { $in: matches.map((message) => message.conversationId) } },
      ],
    };
  }

  private async requireMember(ctx: PermissionContext, userId: Types.ObjectId): Promise<void> {
    const member = await this.members
      .findOne({ workspaceId: ctx.workspaceId, userId, status: 'active' })
      .exec();

    if (!member) {
      throw new BadRequestException({
        code: 'INVALID_ASSIGNEE',
        message: 'Responsável não é membro ativo do workspace.',
      });
    }
  }
}
