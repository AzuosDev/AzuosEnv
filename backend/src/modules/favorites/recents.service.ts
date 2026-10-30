import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PermissionContext } from '../hierarchy/permission.service';
import { MAX_RECENT_ITEMS, RecentEntityType } from './favorite-fields';
import { RecentItem, RecentItemDocument } from './schemas/recent-item.schema';

/**
 * Writes the recently opened tasks and Lists. It only needs its own collection,
 * so the tasks and hierarchy modules can record an open without a circular
 * dependency on the favorites module.
 */
@Injectable()
export class RecentsService {
  private readonly logger = new Logger(RecentsService.name);

  constructor(@InjectModel(RecentItem.name) private readonly model: Model<RecentItem>) {}

  /** Never fails the read that triggered it; the log is enough. */
  async record(
    ctx: PermissionContext,
    entityType: RecentEntityType,
    entityId: Types.ObjectId,
  ): Promise<void> {
    try {
      const result = await this.model
        .updateOne(
          { userId: ctx.userId, workspaceId: ctx.workspaceId, entityType, entityId },
          { $set: { openedAt: new Date() } },
          { upsert: true },
        )
        .exec();

      if (result.upsertedCount > 0) {
        await this.trim(ctx);
      }
    } catch (error) {
      this.logger.warn(
        `Falha ao registrar item recente ${entityType}:${String(entityId)}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Newest first; the caller still filters by what the user can see. */
  recent(ctx: PermissionContext, limit = MAX_RECENT_ITEMS): Promise<RecentItemDocument[]> {
    return this.model
      .find({ userId: ctx.userId, workspaceId: ctx.workspaceId })
      .sort({ openedAt: -1, _id: -1 })
      .limit(limit)
      .exec();
  }

  /** Keeps only the newest rows, so the collection never grows per open. */
  private async trim(ctx: PermissionContext): Promise<void> {
    const scope = { userId: ctx.userId, workspaceId: ctx.workspaceId };
    const oldest = await this.model
      .find(scope)
      .sort({ openedAt: -1, _id: -1 })
      .skip(MAX_RECENT_ITEMS)
      .select('_id')
      .exec();

    if (oldest.length === 0) {
      return;
    }

    await this.model.deleteMany({ ...scope, _id: { $in: oldest.map((doc) => doc._id) } }).exec();
  }

  /** Drops the rows of entities that were purged for good. */
  async removeForEntities(
    workspaceId: Types.ObjectId,
    entityType: RecentEntityType,
    entityIds: Types.ObjectId[],
  ): Promise<void> {
    if (entityIds.length === 0) {
      return;
    }

    await this.model.deleteMany({ workspaceId, entityType, entityId: { $in: entityIds } }).exec();
  }
}
