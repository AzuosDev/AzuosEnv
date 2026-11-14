import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage, buildCursorPage, decodeObjectIdCursor } from '../../common/pagination/cursor';
import { DEFAULT_PAGE_SIZE } from '../../common/pagination/pagination-query.dto';
import { escapeRegex } from '../../common/utils/regex';
import { PermissionContext } from '../hierarchy/permission.service';
import { WaQuickReplyItemDto } from './dto/whatsapp-bot-result.dto';
import {
  CreateWaQuickReplyDto,
  UpdateWaQuickReplyDto,
  WaQuickReplyQueryDto,
} from './dto/whatsapp-bot.dto';
import { WaQuickReply, WaQuickReplyDocument } from './schemas/wa-quick-reply.schema';
import { WaTextVariables, renderWaText } from './whatsapp-bot-text';

/**
 * Canned answers of the team. The listing is what the `/` of the message field
 * searches, so it also resolves the variables when a conversation is given.
 */
@Injectable()
export class WhatsappQuickRepliesService {
  constructor(@InjectModel(WaQuickReply.name) private readonly model: Model<WaQuickReply>) {}

  notFound(): NotFoundException {
    return new NotFoundException({
      code: 'WHATSAPP_QUICK_REPLY_NOT_FOUND',
      message: 'Resposta rápida não encontrada.',
    });
  }

  /** Quick replies of the workspace, the shortcut matching first. */
  async list(
    ctx: PermissionContext,
    query: WaQuickReplyQueryDto,
    variables: WaTextVariables,
  ): Promise<CursorPage<WaQuickReplyItemDto>> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const term = (query.q ?? '').trim();
    const filter: Record<string, unknown> = { workspaceId: ctx.workspaceId };

    if (term.length > 0) {
      const regex = new RegExp(escapeRegex(term), 'i');

      filter.$or = [{ shortcut: regex }, { title: regex }, { text: regex }];
    }

    if (query.cursor) {
      filter._id = { $lt: decodeObjectIdCursor(query.cursor) };
    }

    const docs = await this.model
      .find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .exec();
    const page = buildCursorPage(docs, limit, (doc) => ({ id: String(doc._id) }));

    return {
      items: page.items.map((doc) => this.toItem(doc, variables)),
      nextCursor: page.nextCursor,
    };
  }

  async require(
    ctx: PermissionContext,
    quickReplyId: Types.ObjectId,
  ): Promise<WaQuickReplyDocument> {
    const found = await this.model
      .findOne({ _id: quickReplyId, workspaceId: ctx.workspaceId })
      .exec();

    if (!found) {
      throw this.notFound();
    }

    return found;
  }

  async create(ctx: PermissionContext, dto: CreateWaQuickReplyDto): Promise<WaQuickReplyDocument> {
    await this.assertFreeShortcut(ctx, dto.shortcut, null);

    return this.model.create({
      workspaceId: ctx.workspaceId,
      shortcut: dto.shortcut,
      title: dto.title,
      text: dto.text ?? '',
      mediaUrl: dto.mediaUrl ?? '',
      mediaMime: dto.mediaMime ?? '',
      filename: dto.filename ?? '',
      createdBy: ctx.userId,
    });
  }

  async update(
    ctx: PermissionContext,
    quickReplyId: Types.ObjectId,
    dto: UpdateWaQuickReplyDto,
  ): Promise<WaQuickReplyDocument> {
    const reply = await this.require(ctx, quickReplyId);

    if (dto.shortcut !== undefined && dto.shortcut !== reply.shortcut) {
      await this.assertFreeShortcut(ctx, dto.shortcut, reply._id);
      reply.shortcut = dto.shortcut;
    }

    if (dto.title !== undefined) {
      reply.title = dto.title;
    }

    if (dto.text !== undefined) {
      reply.text = dto.text;
    }

    if (dto.mediaUrl !== undefined) {
      reply.mediaUrl = dto.mediaUrl;
    }

    if (dto.mediaMime !== undefined) {
      reply.mediaMime = dto.mediaMime;
    }

    if (dto.filename !== undefined) {
      reply.filename = dto.filename;
    }

    await reply.save();

    return reply;
  }

  async remove(ctx: PermissionContext, quickReplyId: Types.ObjectId): Promise<void> {
    const reply = await this.require(ctx, quickReplyId);

    await this.model.deleteOne({ _id: reply._id }).exec();
  }

  private toItem(doc: WaQuickReplyDocument, variables: WaTextVariables): WaQuickReplyItemDto {
    return {
      id: String(doc._id),
      shortcut: doc.shortcut,
      title: doc.title,
      text: doc.text,
      rendered: renderWaText(doc.text, variables),
      mediaUrl: doc.mediaUrl,
      mediaMime: doc.mediaMime,
      filename: doc.filename,
    };
  }

  private async assertFreeShortcut(
    ctx: PermissionContext,
    shortcut: string,
    skipId: Types.ObjectId | null,
  ): Promise<void> {
    const taken = await this.model
      .countDocuments({
        workspaceId: ctx.workspaceId,
        shortcut: shortcut.toLowerCase(),
        ...(skipId ? { _id: { $ne: skipId } } : {}),
      })
      .exec();

    if (taken > 0) {
      throw new ConflictException({
        code: 'WHATSAPP_QUICK_REPLY_EXISTS',
        message: 'Já existe uma resposta rápida com este atalho.',
      });
    }
  }
}
