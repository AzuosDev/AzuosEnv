import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage, buildCursorPage, decodeObjectIdCursor } from '../../common/pagination/cursor';
import {
  DEFAULT_PAGE_SIZE,
  PaginationQueryDto,
} from '../../common/pagination/pagination-query.dto';
import { PermissionContext } from '../hierarchy/permission.service';
import { StorageService } from '../storage/storage.service';
import { UploadedFile } from '../collaboration/attachments.service';
import { MAX_UPLOAD_BYTES } from '../collaboration/collaboration-fields';
import { WaCredentials, WaTemplate, WhatsappGraphProvider } from './graph/whatsapp-graph.provider';
import { SendWaMediaDto, SendWaTemplateDto, SendWaTextDto } from './dto/whatsapp.dto';
import { WaContactDocument } from './schemas/wa-contact.schema';
import { WaConversationDocument } from './schemas/wa-conversation.schema';
import { WaMessage, WaMessageDocument } from './schemas/wa-message.schema';
import { WaInboundMessage, WaInboundStatus } from './whatsapp-payload';
import { WhatsappConnectionsService } from './whatsapp-connections.service';
import { WhatsappContactsService } from './whatsapp-contacts.service';
import { WhatsappConversationsService } from './whatsapp-conversations.service';
import {
  WA_MESSAGE_CREATED,
  WA_MESSAGE_STATUS,
  WaMessageCreatedEvent,
  WaMessageStatusEvent,
} from './whatsapp-events';
import {
  WaAccessLevel,
  WaMessageType,
  isStatusAhead,
  isWaMediaType,
  isWindowOpen,
} from './whatsapp-fields';

/** Media types the Cloud API accepts, by the kind of the file. */
function mediaTypeOf(mime: string): WaMessageType {
  if (mime.startsWith('image/')) {
    return mime === 'image/webp' ? 'sticker' : 'image';
  }

  if (mime.startsWith('audio/')) {
    return 'audio';
  }

  if (mime.startsWith('video/')) {
    return 'video';
  }

  return 'document';
}

/** Messages of a conversation: the history, what we send and what Meta sends us. */
@Injectable()
export class WhatsappMessagesService {
  private readonly logger = new Logger(WhatsappMessagesService.name);

  constructor(
    @InjectModel(WaMessage.name) private readonly model: Model<WaMessage>,
    private readonly conversations: WhatsappConversationsService,
    private readonly contacts: WhatsappContactsService,
    private readonly connections: WhatsappConnectionsService,
    private readonly graph: WhatsappGraphProvider,
    private readonly storage: StorageService,
    private readonly events: EventEmitter2,
  ) {}

  windowClosed(): ConflictException {
    return new ConflictException({
      code: 'WINDOW_CLOSED',
      message: 'A janela de 24 h fechou; use um template aprovado.',
    });
  }

  async list(
    ctx: PermissionContext,
    level: WaAccessLevel,
    conversationId: Types.ObjectId,
    query: PaginationQueryDto,
  ): Promise<CursorPage<WaMessageDocument>> {
    const conversation = await this.conversations.require(ctx, level, conversationId);
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const filter: Record<string, unknown> = {
      workspaceId: ctx.workspaceId,
      conversationId: conversation._id,
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

  async templates(workspaceId: Types.ObjectId): Promise<WaTemplate[]> {
    const { credentials } = await this.connections.requireCredentials(workspaceId);

    return this.graph.templates(credentials);
  }

  async sendText(
    ctx: PermissionContext,
    level: WaAccessLevel,
    conversationId: Types.ObjectId,
    dto: SendWaTextDto,
  ): Promise<WaMessageDocument> {
    const { conversation, contact, credentials } = await this.prepare(ctx, level, conversationId);

    if (!isWindowOpen(conversation.lastInboundAt)) {
      throw this.windowClosed();
    }

    const waMessageId = await this.graph.send(credentials, {
      to: contact.waId,
      type: 'text',
      text: dto.text,
      replyTo: dto.replyTo ?? null,
    });

    return this.recordOutbound(ctx, conversation, {
      waMessageId,
      type: 'text',
      body: dto.text,
      replyTo: dto.replyTo ?? null,
    });
  }

  async sendMedia(
    ctx: PermissionContext,
    level: WaAccessLevel,
    conversationId: Types.ObjectId,
    file: UploadedFile | undefined,
    dto: SendWaMediaDto,
  ): Promise<WaMessageDocument> {
    if (!file) {
      throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Envie um arquivo.' });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'O arquivo passa do limite de 25 MB.',
      });
    }

    const { conversation, contact, credentials } = await this.prepare(ctx, level, conversationId);

    if (!isWindowOpen(conversation.lastInboundAt)) {
      throw this.windowClosed();
    }

    const type = mediaTypeOf(file.mimetype);
    const mediaId = await this.graph.upload(credentials, {
      filename: file.originalname,
      mime: file.mimetype,
      buffer: file.buffer,
    });
    const waMessageId = await this.graph.send(credentials, {
      to: contact.waId,
      type,
      mediaId,
      caption: dto.caption,
      filename: file.originalname,
      replyTo: dto.replyTo ?? null,
    });
    const stored = await this.storage.save({
      workspaceId: String(ctx.workspaceId),
      filename: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
    });

    return this.recordOutbound(ctx, conversation, {
      waMessageId,
      type,
      body: dto.caption ?? '',
      replyTo: dto.replyTo ?? null,
      media: {
        storageKey: stored.key,
        mime: file.mimetype,
        caption: dto.caption ?? '',
        filename: file.originalname,
        size: stored.size,
        mediaId,
      },
    });
  }

  /** Template of the WABA: the only thing that reaches a closed window. */
  async sendTemplate(
    ctx: PermissionContext,
    level: WaAccessLevel,
    conversationId: Types.ObjectId,
    dto: SendWaTemplateDto,
  ): Promise<WaMessageDocument> {
    const { conversation, contact, credentials } = await this.prepare(ctx, level, conversationId);
    const variables = dto.variables ?? [];
    const waMessageId = await this.graph.send(credentials, {
      to: contact.waId,
      type: 'template',
      template: { name: dto.name, language: dto.language, variables },
    });

    return this.recordOutbound(ctx, conversation, {
      waMessageId,
      type: 'template',
      body: dto.name,
      replyTo: null,
      payload: { name: dto.name, language: dto.language, variables },
    });
  }

  /**
   * Writes an inbound message. The unique index on waMessageId is what makes the
   * webhook idempotent: a repeated delivery answers null and nothing else runs.
   */
  async ingestInbound(
    conversation: WaConversationDocument,
    message: WaInboundMessage,
    credentials: WaCredentials,
  ): Promise<WaMessageDocument | null> {
    const media = isWaMediaType(message.type)
      ? await this.fetchMedia(conversation.workspaceId, message, credentials)
      : null;

    try {
      const created = await this.model.create({
        workspaceId: conversation.workspaceId,
        conversationId: conversation._id,
        waMessageId: message.waMessageId,
        direction: 'inbound',
        type: message.type,
        body: message.body,
        media,
        payload: message.payload,
        replyTo: message.replyTo,
        status: 'delivered',
        sentAt: message.sentAt,
      });

      this.emitCreated(created);

      return created;
    } catch (error) {
      if (isDuplicateKey(error)) {
        return null;
      }

      throw error;
    }
  }

  /** Applies a status callback; the status never walks back. */
  async applyStatus(
    workspaceId: Types.ObjectId,
    update: WaInboundStatus,
  ): Promise<WaMessageDocument | null> {
    const message = await this.model
      .findOne({ workspaceId, waMessageId: update.waMessageId })
      .exec();

    if (!message || !isStatusAhead(message.status, update.status)) {
      return null;
    }

    message.status = update.status;
    message.error = update.error;
    await message.save();

    this.events.emit(WA_MESSAGE_STATUS, {
      workspaceId,
      conversationId: message.conversationId,
      messageId: message._id,
      status: message.status,
      error: update.error?.message ?? null,
    } satisfies WaMessageStatusEvent);

    return message;
  }

  /** Tells Meta the conversation was opened, so the contact sees the blue ticks. */
  async markReadOnMeta(conversation: WaConversationDocument): Promise<void> {
    const last = await this.model
      .findOne({
        workspaceId: conversation.workspaceId,
        conversationId: conversation._id,
        direction: 'inbound',
        waMessageId: { $ne: null },
      })
      .sort({ _id: -1 })
      .exec();

    if (!last?.waMessageId) {
      return;
    }

    try {
      const { credentials } = await this.connections.requireCredentials(conversation.workspaceId);

      await this.graph.markRead(credentials, last.waMessageId);
    } catch (error) {
      this.logger.warn(
        `Não foi possível marcar como lida na Meta: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** Downloads the file of an inbound message into the StorageService. */
  private async fetchMedia(
    workspaceId: Types.ObjectId,
    message: WaInboundMessage,
    credentials: WaCredentials,
  ): Promise<Record<string, unknown> | null> {
    if (!message.mediaId) {
      return null;
    }

    const info = await this.graph.mediaInfo(credentials, message.mediaId);

    if (!info) {
      return { mediaId: message.mediaId, mime: message.mime ?? '', caption: message.caption };
    }

    const file = await this.graph.download(credentials, info.url);

    if (!file) {
      return { mediaId: message.mediaId, mime: info.mime, caption: message.caption };
    }

    const mime = message.mime ?? info.mime ?? file.mime;
    const filename = message.filename || `${message.waMessageId}${extensionOf(mime)}`;
    const stored = await this.storage.save({
      workspaceId: String(workspaceId),
      filename,
      mimeType: mime,
      buffer: file.buffer,
    });

    return {
      storageKey: stored.key,
      mime,
      caption: message.caption,
      filename,
      size: stored.size,
      mediaId: message.mediaId,
    };
  }

  private async recordOutbound(
    ctx: PermissionContext,
    conversation: WaConversationDocument,
    input: {
      waMessageId: string;
      type: WaMessageType;
      body: string;
      replyTo: string | null;
      media?: Record<string, unknown>;
      payload?: Record<string, unknown>;
    },
  ): Promise<WaMessageDocument> {
    const sentAt = new Date();
    const created = await this.model.create({
      workspaceId: ctx.workspaceId,
      conversationId: conversation._id,
      waMessageId: input.waMessageId,
      direction: 'outbound',
      type: input.type,
      body: input.body,
      media: input.media ?? null,
      payload: input.payload ?? null,
      replyTo: input.replyTo,
      status: 'sent',
      authorId: ctx.userId,
      sentAt,
    });

    await this.conversations.touchOutbound(conversation, sentAt);
    await this.contacts.touch(conversation.contactId, sentAt);
    this.emitCreated(created);

    return created;
  }

  private emitCreated(message: WaMessageDocument): void {
    this.events.emit(WA_MESSAGE_CREATED, {
      workspaceId: message.workspaceId,
      conversationId: message.conversationId,
      messageId: message._id,
      direction: message.direction,
      type: message.type,
      preview: message.body.slice(0, 120),
      authorId: message.authorId,
    } satisfies WaMessageCreatedEvent);
  }

  /** Conversation, contact and credentials of a send, with the opt-out checked. */
  private async prepare(
    ctx: PermissionContext,
    level: WaAccessLevel,
    conversationId: Types.ObjectId,
  ): Promise<{
    conversation: WaConversationDocument;
    contact: WaContactDocument;
    credentials: WaCredentials;
  }> {
    const conversation = await this.conversations.require(ctx, level, conversationId);
    const contact = await this.contacts.require(ctx, conversation.contactId);

    if (contact.optOut) {
      throw new ConflictException({
        code: 'WHATSAPP_CONTACT_OPTED_OUT',
        message: 'Este contato pediu para não receber mensagens.',
      });
    }

    const { credentials } = await this.connections.requireCredentials(ctx.workspaceId);

    return { conversation, contact, credentials };
  }
}

function extensionOf(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'audio/ogg': '.ogg',
    'audio/mpeg': '.mp3',
    'video/mp4': '.mp4',
    'application/pdf': '.pdf',
  };

  return map[mime] ?? '';
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;
}
