import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PermissionContext } from '../hierarchy/permission.service';
import { TaskAccessService } from '../tasks/task-access.service';
import { CreateDependencyDto } from './dto/dependency.dto';
import { DependencyEdge, createsCycle, dependencyEdge } from './dependency-graph';
import { TaskDependency, TaskDependencyDocument } from './schemas/task-dependency.schema';

@Injectable()
export class DependenciesService {
  constructor(
    @InjectModel(TaskDependency.name) private readonly model: Model<TaskDependency>,
    private readonly taskAccess: TaskAccessService,
  ) {}

  async create(
    ctx: PermissionContext,
    idOrCustomId: string,
    dto: CreateDependencyDto,
  ): Promise<TaskDependencyDocument> {
    const { task } = await this.taskAccess.requireTask(ctx, idOrCustomId, 'edit');
    const { task: other } = await this.taskAccess.requireTask(ctx, dto.dependsOnId, 'edit');

    if (String(task._id) === String(other._id)) {
      throw new BadRequestException({
        code: 'INVALID_DEPENDENCY',
        message: 'Uma tarefa não pode depender de si mesma.',
      });
    }

    const edge = dependencyEdge(String(task._id), String(other._id), dto.type);

    if (edge && createsCycle(await this.edges(ctx.workspaceId), edge)) {
      throw new BadRequestException({
        code: 'DEPENDENCY_CYCLE',
        message: 'Esta dependência criaria um ciclo entre as tarefas.',
      });
    }

    try {
      return await this.model.create({
        workspaceId: ctx.workspaceId,
        taskId: task._id,
        dependsOnId: other._id,
        type: dto.type,
        createdBy: ctx.userId,
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException({
          code: 'DEPENDENCY_EXISTS',
          message: 'Esta dependência já existe.',
        });
      }

      throw error;
    }
  }

  /** Rows where the task is either side of the relation. */
  async list(ctx: PermissionContext, idOrCustomId: string): Promise<TaskDependencyDocument[]> {
    const { task } = await this.taskAccess.requireTask(ctx, idOrCustomId, 'view');

    return this.model
      .find({
        workspaceId: ctx.workspaceId,
        $or: [{ taskId: task._id }, { dependsOnId: task._id }],
      })
      .sort({ _id: 1 })
      .exec();
  }

  /**
   * Edges between the given tasks, for the Gantt. Only tasks the requester can
   * see enter, and only edges whose two ends are in that set come back: the
   * caller draws arrows, never discovers a task it has no access to.
   */
  async listMany(ctx: PermissionContext, taskIds: string[]): Promise<TaskDependencyDocument[]> {
    const ids = await this.taskAccess.visibleTaskIds(
      ctx,
      taskIds.map((id) => new Types.ObjectId(id)),
    );

    if (ids.length === 0) {
      return [];
    }

    return this.model
      .find({
        workspaceId: ctx.workspaceId,
        taskId: { $in: ids },
        dependsOnId: { $in: ids },
      })
      .sort({ _id: 1 })
      .exec();
  }

  async remove(ctx: PermissionContext, dependencyId: Types.ObjectId): Promise<void> {
    const dependency = await this.model
      .findOne({ _id: dependencyId, workspaceId: ctx.workspaceId })
      .exec();

    if (!dependency) {
      throw new NotFoundException({
        code: 'DEPENDENCY_NOT_FOUND',
        message: 'Dependência não encontrada.',
      });
    }

    await this.taskAccess.requireTask(ctx, String(dependency.taskId), 'edit');

    await this.model.deleteOne({ _id: dependency._id, workspaceId: ctx.workspaceId }).exec();
  }

  /** Directed edges of the workspace, used to look for cycles. */
  private async edges(workspaceId: Types.ObjectId): Promise<DependencyEdge[]> {
    const rows = await this.model
      .find({ workspaceId, type: { $ne: 'linked' } })
      .select('taskId dependsOnId type')
      .exec();

    return rows
      .map((row) => dependencyEdge(String(row.taskId), String(row.dependsOnId), row.type))
      .filter((edge): edge is DependencyEdge => edge !== null);
  }
}
