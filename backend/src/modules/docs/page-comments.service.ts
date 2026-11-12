import { BadRequestException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage, buildCursorPage, decodeObjectIdCursor } from '../../common/pagination/cursor';
import {
  DEFAULT_PAGE_SIZE,
  PaginationQueryDto,
} from '../../common/pagination/pagination-query.dto';
import { PermissionContext } from '../hierarchy/permission.service';
import { extractMentions } from '../collaboration/mentions';
import { Comment, CommentDocument } from '../collaboration/schemas/comment.schema';
import { MembersService } from '../workspaces/members.service';
import { DocsAccessService } from './docs-access.service';
import { PAGE_COMMENTED, PageCommentedEvent } from './docs-events';
import { CreatePageCommentDto } from './dto/doc-page.dto';
import { DocPageDocument } from './schemas/doc-page.schema';

/** A root comment of the page with the replies of its thread. */
export interface PageCommentThread {
  comment: CommentDocument;
  replies: CommentDocument[];
}

/**
 * Comments of a Doc page. They live in the same `comments` collection as the task
 * comments, with `entityType` page and the `anchor` of the excerpt they refer to.
 */
@Injectable()
export class PageCommentsService {
  constructor(
    @InjectModel(Comment.name) private readonly model: Model<Comment>,
    private readonly access: DocsAccessService,
    private readonly members: MembersService,
    private readonly events: EventEmitter2,
  ) {}

  async create(
    ctx: PermissionContext,
    pageId: Types.ObjectId,
    dto: CreatePageCommentDto,
  ): Promise<CommentDocument> {
    const { page } = await this.access.requirePage(ctx, pageId, 'comment');
    const parentCommentId = dto.parentCommentId
      ? await this.requireThreadRoot(ctx, page, dto.parentCommentId)
      : null;
    const mentions = await this.resolveMentions(ctx, dto.body);

    const comment = await this.model.create({
      workspaceId: ctx.workspaceId,
      entityType: 'page',
      entityId: page._id,
      parentCommentId,
      body: dto.body ?? null,
      bodyText: dto.bodyText,
      anchor: dto.anchor ?? null,
      mentions,
      createdBy: ctx.userId,
    });

    this.events.emit(PAGE_COMMENTED, {
      workspaceId: ctx.workspaceId,
      docId: page.docId,
      pageId: page._id,
      parentPageId: page.parentPageId,
      version: page.version,
      actorId: ctx.userId,
      commentId: comment._id,
      anchor: comment.anchor,
      mentions: comment.mentions,
    } satisfies PageCommentedEvent);

    return comment;
  }

  /** Root comments of the page, each one with the replies of its thread. */
  async list(
    ctx: PermissionContext,
    pageId: Types.ObjectId,
    query: PaginationQueryDto,
  ): Promise<CursorPage<PageCommentThread>> {
    const { page } = await this.access.requirePage(ctx, pageId, 'view');
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const scope = this.pageScope(ctx, page);
    const after = query.cursor ? decodeObjectIdCursor(query.cursor) : null;
    const roots = await this.model
      .find(
        after
          ? { ...scope, parentCommentId: null, _id: { $gt: after } }
          : { ...scope, parentCommentId: null },
      )
      .sort({ _id: 1 })
      .limit(limit + 1)
      .exec();

    const rootPage = buildCursorPage(roots, limit, (comment) => ({ id: String(comment._id) }));
    const replies = await this.model
      .find({ ...scope, parentCommentId: { $in: rootPage.items.map((comment) => comment._id) } })
      .sort({ _id: 1 })
      .exec();

    return {
      items: rootPage.items.map((comment) => ({
        comment,
        replies: replies.filter((reply) => String(reply.parentCommentId) === String(comment._id)),
      })),
      nextCursor: rootPage.nextCursor,
    };
  }

  private async requireThreadRoot(
    ctx: PermissionContext,
    page: DocPageDocument,
    parentCommentId: string,
  ): Promise<Types.ObjectId> {
    const parent = await this.model
      .findOne({ _id: new Types.ObjectId(parentCommentId), ...this.pageScope(ctx, page) })
      .exec();

    if (!parent) {
      throw new BadRequestException({
        code: 'INVALID_COMMENT_PARENT',
        message: 'O comentário pai não pertence a esta página.',
      });
    }

    return parent.parentCommentId ?? parent._id;
  }

  private async resolveMentions(
    ctx: PermissionContext,
    body: Record<string, unknown> | null | undefined,
  ): Promise<Types.ObjectId[]> {
    const ids = extractMentions(body);

    return ids.length === 0 ? [] : this.members.activeUserIds(ctx.workspaceId, ids);
  }

  private pageScope(ctx: PermissionContext, page: DocPageDocument): Record<string, unknown> {
    return {
      workspaceId: ctx.workspaceId,
      entityType: 'page',
      entityId: page._id,
      deletedAt: null,
    };
  }
}
