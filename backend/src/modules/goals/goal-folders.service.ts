import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage, buildCursorPage, decodeObjectIdCursor } from '../../common/pagination/cursor';
import {
  DEFAULT_PAGE_SIZE,
  PaginationQueryDto,
} from '../../common/pagination/pagination-query.dto';
import { PermissionContext } from '../hierarchy/permission.service';
import { CreateGoalFolderDto, UpdateGoalFolderDto } from './dto/goal.dto';
import { DEFAULT_GOAL_COLOR } from './goals-fields';
import { Goal } from './schemas/goal.schema';
import { GoalFolder, GoalFolderDocument } from './schemas/goal-folder.schema';

/** Folders that group the goals of the workspace. */
@Injectable()
export class GoalFoldersService {
  constructor(
    @InjectModel(GoalFolder.name) private readonly model: Model<GoalFolder>,
    @InjectModel(Goal.name) private readonly goals: Model<Goal>,
  ) {}

  folderNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'GOAL_FOLDER_NOT_FOUND',
      message: 'Pasta de metas não encontrada.',
    });
  }

  create(ctx: PermissionContext, dto: CreateGoalFolderDto): Promise<GoalFolderDocument> {
    return this.model.create({
      workspaceId: ctx.workspaceId,
      name: dto.name,
      color: dto.color ?? DEFAULT_GOAL_COLOR,
      createdBy: ctx.userId,
    });
  }

  async list(
    ctx: PermissionContext,
    query: PaginationQueryDto,
  ): Promise<CursorPage<GoalFolderDocument>> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const filter: Record<string, unknown> = { workspaceId: ctx.workspaceId, deletedAt: null };

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

  async update(
    ctx: PermissionContext,
    folderId: Types.ObjectId,
    dto: UpdateGoalFolderDto,
  ): Promise<GoalFolderDocument> {
    const folder = await this.require(ctx, folderId);

    if (dto.name !== undefined) {
      folder.name = dto.name;
    }

    if (dto.color !== undefined) {
      folder.color = dto.color;
    }

    return folder.save();
  }

  /** Deleting the folder keeps its goals, which go back to the root. */
  async remove(ctx: PermissionContext, folderId: Types.ObjectId): Promise<void> {
    const folder = await this.require(ctx, folderId);

    folder.deletedAt = new Date();
    await folder.save();
    await this.goals
      .updateMany(
        { workspaceId: ctx.workspaceId, folderId: folder._id },
        { $set: { folderId: null } },
      )
      .exec();
  }

  private async require(
    ctx: PermissionContext,
    folderId: Types.ObjectId,
  ): Promise<GoalFolderDocument> {
    const folder = await this.model
      .findOne({ _id: folderId, workspaceId: ctx.workspaceId, deletedAt: null })
      .exec();

    if (!folder) {
      throw this.folderNotFound();
    }

    return folder;
  }
}
