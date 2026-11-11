import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HierarchyAccessService } from '../hierarchy/hierarchy-access.service';
import { PermissionContext } from '../hierarchy/permission.service';
import { Task } from '../tasks/schemas/task.schema';
import { TaskAccessService } from '../tasks/task-access.service';
import { CreateTargetDto, UpdateTargetDto } from './dto/target.dto';
import { CLOSED_STATUS_GROUPS, MAX_TARGETS_PER_GOAL } from './goals-fields';
import { GoalDocument } from './schemas/goal.schema';
import { Target, TargetDocument } from './schemas/target.schema';

interface TaskCounts {
  total: number;
  closed: number;
}

/**
 * Targets of a goal. A target of the type `tasks` is never written by hand: its
 * total and its current value are recomputed from the tasks it points at.
 */
@Injectable()
export class TargetsService {
  constructor(
    @InjectModel(Target.name) private readonly model: Model<Target>,
    @InjectModel(Task.name) private readonly tasks: Model<Task>,
    private readonly taskAccess: TaskAccessService,
    private readonly hierarchy: HierarchyAccessService,
  ) {}

  targetNotFound(): NotFoundException {
    return new NotFoundException({ code: 'TARGET_NOT_FOUND', message: 'Alvo não encontrado.' });
  }

  ofGoal(workspaceId: Types.ObjectId, goalId: Types.ObjectId): Promise<TargetDocument[]> {
    return this.model.find({ workspaceId, goalId }).sort({ _id: 1 }).exec();
  }

  ofGoals(workspaceId: Types.ObjectId, goalIds: Types.ObjectId[]): Promise<TargetDocument[]> {
    return this.model
      .find({ workspaceId, goalId: { $in: goalIds } })
      .sort({ _id: 1 })
      .exec();
  }

  async create(
    ctx: PermissionContext,
    goal: GoalDocument,
    dto: CreateTargetDto,
  ): Promise<TargetDocument> {
    const existing = await this.model.countDocuments({
      workspaceId: ctx.workspaceId,
      goalId: goal._id,
    });

    if (existing >= MAX_TARGETS_PER_GOAL) {
      throw new BadRequestException({
        code: 'INVALID_TARGET',
        message: 'A meta já tem o número máximo de alvos.',
      });
    }

    const scope = await this.requireScope(ctx, dto.type, dto.taskIds, this.toObjectId(dto.listId));
    const target = await this.model.create({
      workspaceId: ctx.workspaceId,
      goalId: goal._id,
      name: dto.name,
      type: dto.type,
      start: dto.start ?? 0,
      target: this.requireTargetValue(dto.type, dto.target),
      current: dto.type === 'tasks' ? 0 : (dto.current ?? 0),
      unit: dto.unit ?? null,
      taskIds: scope.taskIds,
      listId: scope.listId,
    });

    return this.refresh(target);
  }

  async update(
    ctx: PermissionContext,
    targetId: Types.ObjectId,
    goal: GoalDocument,
    dto: UpdateTargetDto,
  ): Promise<TargetDocument> {
    const target = await this.requireTarget(ctx, goal, targetId);

    if (dto.name !== undefined) {
      target.name = dto.name;
    }

    if (dto.start !== undefined) {
      target.start = dto.start;
    }

    if (dto.target !== undefined && target.type !== 'tasks') {
      target.target = dto.target;
    }

    if (dto.current !== undefined && target.type !== 'tasks') {
      target.current = dto.current;
    }

    if (dto.unit !== undefined) {
      target.unit = dto.unit ?? null;
    }

    if (dto.taskIds !== undefined || dto.listId !== undefined) {
      const scope = await this.requireScope(
        ctx,
        target.type,
        dto.taskIds ?? target.taskIds.map((id) => String(id)),
        dto.listId === undefined ? target.listId : this.toObjectId(dto.listId),
      );

      target.taskIds = scope.taskIds;
      target.listId = scope.listId;
    }

    return this.refresh(target);
  }

  async remove(
    ctx: PermissionContext,
    targetId: Types.ObjectId,
    goal: GoalDocument,
  ): Promise<void> {
    const target = await this.requireTarget(ctx, goal, targetId);

    await this.model.deleteOne({ _id: target._id }).exec();
  }

  async removeOfGoal(workspaceId: Types.ObjectId, goalId: Types.ObjectId): Promise<void> {
    await this.model.deleteMany({ workspaceId, goalId }).exec();
  }

  /**
   * Recomputes every `tasks` target that counts this task. Called from the domain
   * events of the task, so closing a task walks the goal forward by itself.
   */
  async refreshForTask(
    workspaceId: Types.ObjectId,
    taskId: Types.ObjectId,
    listIds: Types.ObjectId[],
  ): Promise<void> {
    const targets = await this.model
      .find({
        workspaceId,
        type: 'tasks',
        $or: [{ taskIds: taskId }, ...(listIds.length ? [{ listId: { $in: listIds } }] : [])],
      })
      .exec();

    for (const target of targets) {
      await this.refresh(target);
    }
  }

  /**
   * Saves the target, recounting the tasks first when it is of the type `tasks`.
   * Every write of a target ends here, so a hand-kept value is persisted too.
   */
  async refresh(target: TargetDocument): Promise<TargetDocument> {
    if (target.type === 'tasks') {
      const counts = await this.countTasks(target);

      target.target = counts.total;
      target.current = counts.closed;
    }

    return target.save();
  }

  private async countTasks(target: TargetDocument): Promise<TaskCounts> {
    const filter = target.taskIds.length
      ? { _id: { $in: target.taskIds } }
      : target.listId
        ? { listIds: target.listId }
        : null;

    if (!filter) {
      return { total: 0, closed: 0 };
    }

    const base = {
      workspaceId: target.workspaceId,
      deletedAt: null,
      ...filter,
    };

    return {
      total: await this.tasks.countDocuments(base).exec(),
      closed: await this.tasks
        .countDocuments({ ...base, statusGroup: { $in: [...CLOSED_STATUS_GROUPS] } })
        .exec(),
    };
  }

  private async requireTarget(
    ctx: PermissionContext,
    goal: GoalDocument,
    targetId: Types.ObjectId,
  ): Promise<TargetDocument> {
    const target = await this.model
      .findOne({ _id: targetId, workspaceId: ctx.workspaceId, goalId: goal._id })
      .exec();

    if (!target) {
      throw this.targetNotFound();
    }

    return target;
  }

  private requireTargetValue(type: CreateTargetDto['type'], value: number | undefined): number {
    if (type === 'tasks') {
      return 0;
    }

    if (type === 'boolean') {
      return 1;
    }

    if (value === undefined) {
      throw new BadRequestException({
        code: 'INVALID_TARGET',
        message: 'Informe o valor do alvo.',
      });
    }

    return value;
  }

  /** Checks that the requester can see everything the target is going to count. */
  private async requireScope(
    ctx: PermissionContext,
    type: CreateTargetDto['type'],
    taskIds: string[] | undefined,
    listId: Types.ObjectId | null,
  ): Promise<{ taskIds: Types.ObjectId[]; listId: Types.ObjectId | null }> {
    if (type !== 'tasks') {
      return { taskIds: [], listId: null };
    }

    if (!taskIds?.length && !listId) {
      throw new BadRequestException({
        code: 'INVALID_TARGET',
        message: 'Informe taskIds ou listId no alvo do tipo tasks.',
      });
    }

    const ids: Types.ObjectId[] = [];

    for (const id of [...new Set(taskIds ?? [])]) {
      const { task } = await this.taskAccess.requireTask(ctx, id, 'view');

      ids.push(task._id);
    }

    if (listId) {
      await this.hierarchy.requireList(ctx, listId, 'view');
    }

    return { taskIds: ids, listId: ids.length ? null : listId };
  }

  private toObjectId(value: string | null | undefined): Types.ObjectId | null {
    return value ? new Types.ObjectId(value) : null;
  }
}
