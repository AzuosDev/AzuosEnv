import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage, paginateByIdDesc } from '../../common/pagination/cursor';
import { DEFAULT_PAGE_SIZE } from '../../common/pagination/pagination-query.dto';
import { PermissionContext } from '../hierarchy/permission.service';
import { TaskDocument } from '../tasks/schemas/task.schema';
import { TasksService } from '../tasks/tasks.service';
import {
  WHITEBOARD_CREATED,
  WHITEBOARD_DELETED,
  WHITEBOARD_UPDATED,
  WhiteboardCreatedEvent,
  WhiteboardDeletedEvent,
  WhiteboardEventBase,
  WhiteboardUpdatedEvent,
} from './whiteboard-events';
import {
  WhiteboardElement,
  WhiteboardOp,
  applyOps,
  elementNotFound,
  elementTaskName,
  normalizeElement,
} from './whiteboard-elements';
import { WhiteboardLocationType } from './whiteboard-fields';
import { WhiteboardsAccessService } from './whiteboards-access.service';
import {
  CreateWhiteboardDto,
  ElementToTaskDto,
  PatchWhiteboardElementsDto,
  UpdateWhiteboardDto,
  WhiteboardQueryDto,
} from './dto/whiteboard.dto';
import { Whiteboard, WhiteboardDocument } from './schemas/whiteboard.schema';

export interface ElementTaskResult {
  task: TaskDocument;
  whiteboard: WhiteboardDocument;
  elementId: string;
}

@Injectable()
export class WhiteboardsService {
  constructor(
    @InjectModel(Whiteboard.name) private readonly model: Model<Whiteboard>,
    private readonly access: WhiteboardsAccessService,
    private readonly tasks: TasksService,
    private readonly events: EventEmitter2,
  ) {}

  async create(ctx: PermissionContext, dto: CreateWhiteboardDto): Promise<WhiteboardDocument> {
    const locationId = this.locationIdOf(dto.locationType, dto.locationId);

    await this.access.requireLocation(ctx, dto.locationType, locationId, 'edit');

    const board = await this.model.create({
      workspaceId: ctx.workspaceId,
      locationType: dto.locationType,
      locationId,
      title: dto.title,
      elements: (dto.elements ?? []).map((element) => normalizeElement(element)),
      version: 1,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    this.events.emit(
      WHITEBOARD_CREATED,
      this.baseEvent(ctx, board) satisfies WhiteboardCreatedEvent,
    );

    return board;
  }

  async list(
    ctx: PermissionContext,
    query: WhiteboardQueryDto,
  ): Promise<CursorPage<WhiteboardDocument>> {
    const filter: Record<string, unknown> = {};

    if (query.locationType) {
      filter.locationType = query.locationType;
    }

    if (query.locationId) {
      filter.locationId = new Types.ObjectId(query.locationId);
    }

    return paginateByIdDesc(
      await this.access.visibleWhiteboards(ctx, filter),
      query.limit ?? DEFAULT_PAGE_SIZE,
      query.cursor,
    );
  }

  get(ctx: PermissionContext, whiteboardId: Types.ObjectId): Promise<WhiteboardDocument> {
    return this.access.requireWhiteboard(ctx, whiteboardId, 'view');
  }

  async update(
    ctx: PermissionContext,
    whiteboardId: Types.ObjectId,
    dto: UpdateWhiteboardDto,
  ): Promise<WhiteboardDocument> {
    const board = await this.access.requireWhiteboard(ctx, whiteboardId, 'edit');

    if (dto.title !== undefined) {
      board.title = dto.title;
    }

    board.updatedBy = ctx.userId;
    await board.save();

    return board;
  }

  /**
   * Batch of operations over the elements. The client sends the version it loaded
   * and a divergence answers 409, so two people on the same canvas never overwrite
   * each other silently.
   */
  async patchElements(
    ctx: PermissionContext,
    whiteboardId: Types.ObjectId,
    dto: PatchWhiteboardElementsDto,
  ): Promise<WhiteboardDocument> {
    const board = await this.access.requireWhiteboard(ctx, whiteboardId, 'edit');

    if (dto.version !== board.version) {
      throw new ConflictException({
        code: 'WHITEBOARD_VERSION_CONFLICT',
        message: `O quadro foi alterado por outra pessoa (versão atual ${board.version}).`,
      });
    }

    const ops: WhiteboardOp[] = dto.ops.map((op) => ({
      op: op.op,
      id: op.id,
      element: op.element,
    }));

    board.elements = applyOps(this.elementsOf(board), ops);
    board.version += 1;
    board.updatedBy = ctx.userId;
    board.markModified('elements');
    await board.save();

    this.events.emit(WHITEBOARD_UPDATED, {
      ...this.baseEvent(ctx, board),
      ops: ops.map((op) => ({ op: op.op, id: this.opId(op) })),
    } satisfies WhiteboardUpdatedEvent);

    return board;
  }

  /** Turns an element into a task and keeps the link on the element. */
  async elementToTask(
    ctx: PermissionContext,
    whiteboardId: Types.ObjectId,
    elementId: string,
    taskPrefix: string,
    dto: ElementToTaskDto,
  ): Promise<ElementTaskResult> {
    const board = await this.access.requireWhiteboard(ctx, whiteboardId, 'edit');
    const elements = this.elementsOf(board);
    const element = elements.find((one) => one.id === elementId);

    if (!element) {
      throw elementNotFound();
    }

    const task = await this.tasks.create(ctx, new Types.ObjectId(dto.listId), taskPrefix, {
      name: elementTaskName(element),
      descriptionText: `Elemento do quadro ${board.title}.`,
    });

    board.elements = elements.map((one) =>
      one.id === elementId ? { ...one, taskId: String(task._id) } : one,
    );
    board.version += 1;
    board.updatedBy = ctx.userId;
    board.markModified('elements');
    await board.save();

    this.events.emit(WHITEBOARD_UPDATED, {
      ...this.baseEvent(ctx, board),
      ops: [{ op: 'update', id: elementId }],
    } satisfies WhiteboardUpdatedEvent);

    return { task, whiteboard: board, elementId };
  }

  /** Soft delete; the whiteboard keeps its elements until the trash purges it. */
  async remove(ctx: PermissionContext, whiteboardId: Types.ObjectId): Promise<void> {
    const board = await this.access.requireWhiteboard(ctx, whiteboardId, 'full');

    board.deletedAt = new Date();
    board.updatedBy = ctx.userId;
    await board.save();

    this.events.emit(
      WHITEBOARD_DELETED,
      this.baseEvent(ctx, board) satisfies WhiteboardDeletedEvent,
    );
  }

  async restore(ctx: PermissionContext, whiteboardId: Types.ObjectId): Promise<WhiteboardDocument> {
    const board = await this.access.requireWhiteboard(ctx, whiteboardId, 'full', {
      includeDeleted: true,
    });

    board.deletedAt = null;
    board.updatedBy = ctx.userId;
    await board.save();

    return board;
  }

  /** Stored elements come back as Mixed; normalizing fills anything missing. */
  private elementsOf(board: WhiteboardDocument): WhiteboardElement[] {
    return (board.elements ?? []).map((element) =>
      normalizeElement({ ...element } as Record<string, unknown>),
    );
  }

  private opId(op: WhiteboardOp): string {
    if (op.id) {
      return op.id;
    }

    return typeof op.element?.id === 'string' ? op.element.id : '';
  }

  private baseEvent(ctx: PermissionContext, board: WhiteboardDocument): WhiteboardEventBase {
    return {
      workspaceId: board.workspaceId,
      whiteboardId: board._id,
      version: board.version,
      actorId: ctx.userId,
    };
  }

  private locationIdOf(
    locationType: WhiteboardLocationType,
    locationId?: string,
  ): Types.ObjectId | null {
    if (locationType === 'workspace') {
      return null;
    }

    if (!locationId) {
      throw new BadRequestException({
        code: 'INVALID_WHITEBOARD_LOCATION',
        message: 'locationId é obrigatório fora do local workspace.',
      });
    }

    return new Types.ObjectId(locationId);
  }
}
