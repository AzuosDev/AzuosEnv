import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CursorPage,
  buildCursorPage,
  decodeObjectIdCursor,
  paginateByIdDesc,
} from '../../common/pagination/cursor';
import {
  DEFAULT_PAGE_SIZE,
  PaginationQueryDto,
} from '../../common/pagination/pagination-query.dto';
import { PermissionLevel } from '../hierarchy/permission-levels';
import { PermissionContext } from '../hierarchy/permission.service';
import { TaskAccessService } from '../tasks/task-access.service';
import { TaskChanges } from '../tasks/task-events';
import { recordChange } from '../tasks/task-diff';
import { TaskDocument } from '../tasks/schemas/task.schema';
import { MembersService } from '../workspaces/members.service';
import { MAX_COLLABORATION_SCAN } from './collaboration-fields';
import {
  COMMENT_CREATED,
  COMMENT_UPDATED,
  CommentCreatedEvent,
  CommentUpdatedEvent,
} from './collaboration-events';
import {
  AssignCommentDto,
  AssignedCommentsQueryDto,
  CreateCommentDto,
  ReactionDto,
  UpdateCommentDto,
} from './dto/comment.dto';
import { extractMentions } from './mentions';
import { Comment, CommentDocument } from './schemas/comment.schema';

/** A root comment with the replies of its thread. */
export interface CommentThread {
  comment: CommentDocument;
  replies: CommentDocument[];
}

interface CommentWithTask {
  comment: CommentDocument;
  task: TaskDocument;
}

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Comment.name) private readonly model: Model<Comment>,
    private readonly taskAccess: TaskAccessService,
    private readonly members: MembersService,
    private readonly events: EventEmitter2,
  ) {}

  async create(
    ctx: PermissionContext,
    idOrCustomId: string,
    dto: CreateCommentDto,
  ): Promise<CommentDocument> {
    const { task } = await this.taskAccess.requireTask(ctx, idOrCustomId, 'comment');
    const parentCommentId = dto.parentCommentId
      ? await this.requireThreadRoot(ctx, task, dto.parentCommentId)
      : null;

    const comment = await this.model.create({
      workspaceId: ctx.workspaceId,
      entityType: 'task',
      entityId: task._id,
      parentCommentId,
      body: dto.body ?? null,
      bodyText: dto.bodyText,
      mentions: await this.resolveMentions(ctx, dto.body),
      assigneeId: await this.requireAssignee(ctx, dto.assigneeId),
      createdBy: ctx.userId,
    });

    this.events.emit(
      COMMENT_CREATED,
      this.baseEvent(ctx, comment, task) satisfies CommentCreatedEvent,
    );

    return comment;
  }

  /** Root comments of the task, each one with the replies of its thread. */
  async list(
    ctx: PermissionContext,
    idOrCustomId: string,
    query: PaginationQueryDto,
  ): Promise<CursorPage<CommentThread>> {
    const { task } = await this.taskAccess.requireTask(ctx, idOrCustomId, 'view');
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const after = query.cursor ? decodeObjectIdCursor(query.cursor) : null;
    const roots = await this.model
      .find(
        after
          ? { ...this.taskScope(ctx, task), parentCommentId: null, _id: { $gt: after } }
          : { ...this.taskScope(ctx, task), parentCommentId: null },
      )
      .sort({ _id: 1 })
      .limit(limit + 1)
      .exec();

    const page = buildCursorPage(roots, limit, (comment) => ({ id: String(comment._id) }));
    const replies = await this.model
      .find({
        ...this.taskScope(ctx, task),
        parentCommentId: { $in: page.items.map((comment) => comment._id) },
      })
      .sort({ _id: 1 })
      .exec();

    return {
      items: page.items.map((comment) => ({
        comment,
        replies: replies.filter((reply) => String(reply.parentCommentId) === String(comment._id)),
      })),
      nextCursor: page.nextCursor,
    };
  }

  async update(
    ctx: PermissionContext,
    commentId: Types.ObjectId,
    dto: UpdateCommentDto,
  ): Promise<CommentDocument> {
    const { comment, task } = await this.requireComment(ctx, commentId, 'comment');

    this.requireAuthor(ctx, comment);

    const changes: TaskChanges = {};

    if (dto.body !== undefined) {
      const body = dto.body ?? null;

      if (recordChange(changes, 'body', comment.body, body)) {
        comment.body = body;
        comment.mentions = await this.resolveMentions(ctx, body);
      }
    }

    if (
      dto.bodyText !== undefined &&
      recordChange(changes, 'bodyText', comment.bodyText, dto.bodyText)
    ) {
      comment.bodyText = dto.bodyText;
    }

    if (Object.keys(changes).length === 0) {
      return comment;
    }

    comment.editedAt = new Date();

    return this.saveWithChanges(ctx, comment, task, changes);
  }

  async remove(ctx: PermissionContext, commentId: Types.ObjectId): Promise<void> {
    const { comment } = await this.requireComment(ctx, commentId, 'comment');

    if (String(comment.createdBy) !== String(ctx.userId)) {
      await this.taskAccess.requireTask(ctx, String(comment.entityId), 'full');
    }

    comment.deletedAt = new Date();
    await comment.save();
  }

  /** Reacting again with the same emoji removes the reaction. */
  async react(
    ctx: PermissionContext,
    commentId: Types.ObjectId,
    dto: ReactionDto,
  ): Promise<CommentDocument> {
    const { comment } = await this.requireComment(ctx, commentId, 'comment');
    const reaction = comment.reactions.find((candidate) => candidate.emoji === dto.emoji);

    if (!reaction) {
      comment.reactions.push({ emoji: dto.emoji, userIds: [ctx.userId] });

      return comment.save();
    }

    const reacted = reaction.userIds.some((userId) => String(userId) === String(ctx.userId));

    reaction.userIds = reacted
      ? reaction.userIds.filter((userId) => String(userId) !== String(ctx.userId))
      : [...reaction.userIds, ctx.userId];

    comment.reactions = comment.reactions.filter((candidate) => candidate.userIds.length > 0);

    return comment.save();
  }

  async assign(
    ctx: PermissionContext,
    commentId: Types.ObjectId,
    dto: AssignCommentDto,
  ): Promise<CommentDocument> {
    const { comment, task } = await this.requireComment(ctx, commentId, 'comment');
    const assigneeId = await this.requireAssignee(ctx, dto.userId);
    const changes: TaskChanges = {};

    if (!recordChange(changes, 'assigneeId', comment.assigneeId, assigneeId)) {
      return comment;
    }

    comment.assigneeId = assigneeId;

    return this.saveWithChanges(ctx, comment, task, changes);
  }

  async setResolved(
    ctx: PermissionContext,
    commentId: Types.ObjectId,
    resolved: boolean,
  ): Promise<CommentDocument> {
    const { comment, task } = await this.requireComment(ctx, commentId, 'comment');
    const resolvedAt = resolved ? new Date() : null;
    const changes: TaskChanges = {};

    if (!recordChange(changes, 'resolvedAt', comment.resolvedAt, resolvedAt)) {
      return comment;
    }

    comment.resolvedAt = resolvedAt;
    comment.resolvedBy = resolved ? ctx.userId : null;

    return this.saveWithChanges(ctx, comment, task, changes);
  }

  /** Comments assigned to the requester, newest first. */
  async assigned(
    ctx: PermissionContext,
    query: AssignedCommentsQueryDto,
  ): Promise<CursorPage<CommentDocument>> {
    const resolved = (query.status ?? 'open') === 'resolved';
    const docs = await this.model
      .find(
        resolved
          ? {
              workspaceId: ctx.workspaceId,
              assigneeId: ctx.userId,
              deletedAt: null,
              resolvedAt: { $ne: null },
            }
          : {
              workspaceId: ctx.workspaceId,
              assigneeId: ctx.userId,
              deletedAt: null,
              resolvedAt: null,
            },
      )
      .sort({ _id: -1 })
      .limit(MAX_COLLABORATION_SCAN)
      .exec();

    return paginateByIdDesc(
      await this.visibleOnly(ctx, docs),
      query.limit ?? DEFAULT_PAGE_SIZE,
      query.cursor,
    );
  }

  /** Replies written by other people to the comments of the requester. */
  async replies(
    ctx: PermissionContext,
    query: PaginationQueryDto,
  ): Promise<CursorPage<CommentDocument>> {
    const mine = await this.model
      .find({ workspaceId: ctx.workspaceId, createdBy: ctx.userId })
      .select('_id')
      .sort({ _id: -1 })
      .limit(MAX_COLLABORATION_SCAN)
      .exec();

    if (mine.length === 0) {
      return { items: [], nextCursor: null };
    }

    const docs = await this.model
      .find({
        workspaceId: ctx.workspaceId,
        deletedAt: null,
        parentCommentId: { $in: mine.map((comment) => comment._id) },
        createdBy: { $ne: ctx.userId },
      })
      .sort({ _id: -1 })
      .limit(MAX_COLLABORATION_SCAN)
      .exec();

    return paginateByIdDesc(
      await this.visibleOnly(ctx, docs),
      query.limit ?? DEFAULT_PAGE_SIZE,
      query.cursor,
    );
  }

  /** Loads the comment and enforces the level on the task it belongs to. */
  async requireComment(
    ctx: PermissionContext,
    commentId: Types.ObjectId,
    required: PermissionLevel,
  ): Promise<CommentWithTask> {
    const comment = await this.model
      .findOne({ _id: commentId, workspaceId: ctx.workspaceId, deletedAt: null })
      .exec();

    if (!comment || comment.entityType !== 'task') {
      throw this.commentNotFound();
    }

    const { task } = await this.taskAccess.requireTask(ctx, String(comment.entityId), required);

    return { comment, task };
  }

  commentNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'COMMENT_NOT_FOUND',
      message: 'Comentário não encontrado.',
    });
  }

  requireAuthor(ctx: PermissionContext, comment: CommentDocument): void {
    if (String(comment.createdBy) !== String(ctx.userId)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_COMMENT',
        message: 'Apenas o autor pode alterar este comentário.',
      });
    }
  }

  /** Replies always hang from the root of the thread. */
  private async requireThreadRoot(
    ctx: PermissionContext,
    task: TaskDocument,
    parentCommentId: string,
  ): Promise<Types.ObjectId> {
    const parent = await this.model
      .findOne({
        _id: new Types.ObjectId(parentCommentId),
        ...this.taskScope(ctx, task),
      })
      .exec();

    if (!parent) {
      throw new BadRequestException({
        code: 'INVALID_COMMENT_PARENT',
        message: 'O comentário pai não pertence a esta tarefa.',
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

  private async requireAssignee(
    ctx: PermissionContext,
    assigneeId: string | null | undefined,
  ): Promise<Types.ObjectId | null> {
    if (!assigneeId) {
      return null;
    }

    const id = new Types.ObjectId(assigneeId);
    const active = await this.members.activeUserIds(ctx.workspaceId, [id]);

    if (active.length === 0) {
      throw new BadRequestException({
        code: 'INVALID_COMMENT_ASSIGNEE',
        message: 'O responsável pelo comentário não é membro ativo deste workspace.',
      });
    }

    return id;
  }

  /** Drops the comments whose task the requester cannot see. */
  private async visibleOnly(
    ctx: PermissionContext,
    comments: CommentDocument[],
  ): Promise<CommentDocument[]> {
    const seen = new Map<string, boolean>();
    const visible: CommentDocument[] = [];

    for (const comment of comments) {
      const key = String(comment.entityId);

      if (!seen.has(key)) {
        seen.set(key, await this.canViewTask(ctx, key));
      }

      if (seen.get(key)) {
        visible.push(comment);
      }
    }

    return visible;
  }

  private async canViewTask(ctx: PermissionContext, taskId: string): Promise<boolean> {
    try {
      await this.taskAccess.requireTask(ctx, taskId, 'view');

      return true;
    } catch {
      return false;
    }
  }

  private async saveWithChanges(
    ctx: PermissionContext,
    comment: CommentDocument,
    task: TaskDocument,
    changes: TaskChanges,
  ): Promise<CommentDocument> {
    await comment.save();

    this.events.emit(COMMENT_UPDATED, {
      ...this.baseEvent(ctx, comment, task),
      changes,
    } satisfies CommentUpdatedEvent);

    return comment;
  }

  private baseEvent(ctx: PermissionContext, comment: CommentDocument, task: TaskDocument) {
    return {
      workspaceId: ctx.workspaceId,
      commentId: comment._id,
      entityType: comment.entityType,
      entityId: comment.entityId,
      parentCommentId: comment.parentCommentId,
      taskId: task._id,
      listId: task.listId,
      mentions: comment.mentions,
      assigneeId: comment.assigneeId,
      actorId: ctx.userId,
    };
  }

  private taskScope(ctx: PermissionContext, task: TaskDocument): Record<string, unknown> {
    return {
      workspaceId: ctx.workspaceId,
      entityType: 'task',
      entityId: task._id,
      deletedAt: null,
    };
  }
}
