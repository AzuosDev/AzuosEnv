import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage, buildCursorPage, decodeObjectIdCursor } from '../../common/pagination/cursor';
import { DEFAULT_PAGE_SIZE } from '../../common/pagination/pagination-query.dto';
import { PermissionContext } from '../hierarchy/permission.service';
import { MembersService } from '../workspaces/members.service';
import { CreateGoalDto, GoalQueryDto, UpdateGoalDto } from './dto/goal.dto';
import { goalPercent, targetPercent } from './goal-progress';
import { DEFAULT_GOAL_COLOR } from './goals-fields';
import { GoalFolder } from './schemas/goal-folder.schema';
import { Goal, GoalDocument } from './schemas/goal.schema';
import { TargetDocument } from './schemas/target.schema';
import { TargetsService } from './targets.service';

/** A goal with its targets and the progress computed from them. */
export interface GoalView {
  goal: GoalDocument;
  targets: TargetDocument[];
  progress: number;
}

@Injectable()
export class GoalsService {
  constructor(
    @InjectModel(Goal.name) private readonly model: Model<Goal>,
    @InjectModel(GoalFolder.name) private readonly folders: Model<GoalFolder>,
    private readonly targets: TargetsService,
    private readonly members: MembersService,
  ) {}

  goalNotFound(): NotFoundException {
    return new NotFoundException({ code: 'GOAL_NOT_FOUND', message: 'Meta não encontrada.' });
  }

  async create(ctx: PermissionContext, dto: CreateGoalDto): Promise<GoalDocument> {
    return this.model.create({
      workspaceId: ctx.workspaceId,
      folderId: dto.folderId ? await this.requireFolder(ctx, dto.folderId) : null,
      name: dto.name,
      description: dto.description ?? null,
      ownerIds: await this.requireOwners(ctx, dto.ownerIds),
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      color: dto.color ?? DEFAULT_GOAL_COLOR,
      private: dto.private ?? false,
      completedAt: null,
      createdBy: ctx.userId,
    });
  }

  /** Visible goals of the workspace, newest first, with the progress of each one. */
  async list(ctx: PermissionContext, query: GoalQueryDto): Promise<CursorPage<GoalView>> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const filter: Record<string, unknown> = this.visibleFilter(ctx);

    if (query.folderId) {
      filter.folderId = new Types.ObjectId(query.folderId);
    }

    if (query.mine) {
      filter.ownerIds = ctx.userId;
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
    const targets = await this.targets.ofGoals(
      ctx.workspaceId,
      page.items.map((goal) => goal._id),
    );

    return {
      items: page.items.map((goal) => this.viewOf(goal, this.targetsOf(targets, goal._id))),
      nextCursor: page.nextCursor,
    };
  }

  async get(ctx: PermissionContext, goalId: Types.ObjectId): Promise<GoalView> {
    const goal = await this.requireGoal(ctx, goalId);

    return this.viewOf(goal, await this.targets.ofGoal(ctx.workspaceId, goal._id));
  }

  async update(
    ctx: PermissionContext,
    goalId: Types.ObjectId,
    dto: UpdateGoalDto,
  ): Promise<GoalView> {
    const goal = await this.requireGoal(ctx, goalId, true);

    if (dto.folderId !== undefined) {
      goal.folderId = dto.folderId ? await this.requireFolder(ctx, dto.folderId) : null;
    }

    if (dto.name !== undefined) {
      goal.name = dto.name;
    }

    if (dto.description !== undefined) {
      goal.description = dto.description ?? null;
    }

    if (dto.ownerIds !== undefined) {
      goal.ownerIds = await this.requireOwners(ctx, dto.ownerIds);
    }

    if (dto.dueDate !== undefined) {
      goal.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }

    if (dto.color !== undefined) {
      goal.color = dto.color;
    }

    if (dto.private !== undefined) {
      goal.private = dto.private;
    }

    if (dto.completed !== undefined) {
      goal.completedAt = dto.completed ? (goal.completedAt ?? new Date()) : null;
    }

    await goal.save();

    return this.viewOf(goal, await this.targets.ofGoal(ctx.workspaceId, goal._id));
  }

  async remove(ctx: PermissionContext, goalId: Types.ObjectId): Promise<void> {
    const goal = await this.requireGoal(ctx, goalId, true);

    goal.deletedAt = new Date();
    await goal.save();
    await this.targets.removeOfGoal(ctx.workspaceId, goal._id);
  }

  /** The goal plus the permission to use it; writing it asks for ownership. */
  async requireGoal(
    ctx: PermissionContext,
    goalId: Types.ObjectId,
    forWrite = false,
  ): Promise<GoalDocument> {
    const goal = await this.model
      .findOne({ _id: goalId, workspaceId: ctx.workspaceId, deletedAt: null })
      .exec();

    if (!goal || !this.canSee(ctx, goal)) {
      throw this.goalNotFound();
    }

    if (forWrite && !this.canWrite(ctx, goal)) {
      throw this.goalNotFound();
    }

    return goal;
  }

  viewOf(goal: GoalDocument, targets: TargetDocument[]): GoalView {
    return {
      goal,
      targets,
      progress: goalPercent(targets.map((target) => this.progressInputOf(target))),
    };
  }

  /** Progress of a single target, used by the targets controller. */
  percentOf(target: TargetDocument): number {
    return targetPercent(this.progressInputOf(target));
  }

  private progressInputOf(target: TargetDocument): {
    type: TargetDocument['type'];
    start: number;
    target: number;
    current: number;
  } {
    return {
      type: target.type,
      start: target.start,
      target: target.target,
      current: target.current,
    };
  }

  private targetsOf(targets: TargetDocument[], goalId: Types.ObjectId): TargetDocument[] {
    return targets.filter((target) => String(target.goalId) === String(goalId));
  }

  private canSee(ctx: PermissionContext, goal: GoalDocument): boolean {
    return !goal.private || this.canWrite(ctx, goal);
  }

  /** The author and the owners of the goal are the ones that change it. */
  private canWrite(ctx: PermissionContext, goal: GoalDocument): boolean {
    return (
      String(goal.createdBy) === String(ctx.userId) ||
      goal.ownerIds.some((ownerId) => String(ownerId) === String(ctx.userId))
    );
  }

  private visibleFilter(ctx: PermissionContext): Record<string, unknown> {
    return {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
      $or: [{ private: false }, { createdBy: ctx.userId }, { ownerIds: ctx.userId }],
    };
  }

  private async requireFolder(ctx: PermissionContext, folderId: string): Promise<Types.ObjectId> {
    const folder = await this.folders
      .findOne({ _id: new Types.ObjectId(folderId), workspaceId: ctx.workspaceId, deletedAt: null })
      .exec();

    if (!folder) {
      throw new NotFoundException({
        code: 'GOAL_FOLDER_NOT_FOUND',
        message: 'Pasta de metas não encontrada.',
      });
    }

    return folder._id;
  }

  private async requireOwners(
    ctx: PermissionContext,
    ownerIds: string[] | undefined,
  ): Promise<Types.ObjectId[]> {
    if (!ownerIds?.length) {
      return [];
    }

    const ids = [...new Set(ownerIds)].map((id) => new Types.ObjectId(id));
    const active = await this.members.activeUserIds(ctx.workspaceId, ids);

    if (active.length !== ids.length) {
      throw new BadRequestException({
        code: 'INVALID_GOAL_OWNERS',
        message: 'Um ou mais donos não são membros ativos deste workspace.',
      });
    }

    return ids;
  }
}
