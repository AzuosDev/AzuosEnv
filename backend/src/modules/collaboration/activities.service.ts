import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage, buildCursorPage, decodeObjectIdCursor } from '../../common/pagination/cursor';
import {
  DEFAULT_PAGE_SIZE,
  PaginationQueryDto,
} from '../../common/pagination/pagination-query.dto';
import { PermissionContext } from '../hierarchy/permission.service';
import { TaskAccessService } from '../tasks/task-access.service';
import { TaskChanges } from '../tasks/task-events';
import { ActivityAction, ActivityEntityType } from './collaboration-fields';
import { ActivityQueryDto } from './dto/activity.dto';
import { Activity, ActivityDocument } from './schemas/activity.schema';

export interface RecordActivityInput {
  workspaceId: Types.ObjectId;
  entityType: ActivityEntityType;
  entityId: Types.ObjectId;
  action: ActivityAction;
  actorId: Types.ObjectId;
  changes?: TaskChanges;
  taskId?: Types.ObjectId | null;
  listId?: Types.ObjectId | null;
}

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectModel(Activity.name) private readonly model: Model<Activity>,
    private readonly taskAccess: TaskAccessService,
  ) {}

  async record(input: RecordActivityInput): Promise<ActivityDocument> {
    return this.model.create({
      workspaceId: input.workspaceId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorId: input.actorId,
      changes: toChangeList(input.changes),
      taskId: input.taskId ?? null,
      listId: input.listId ?? null,
    });
  }

  /** History of the task, newest first. */
  async forTask(
    ctx: PermissionContext,
    idOrCustomId: string,
    query: PaginationQueryDto,
  ): Promise<CursorPage<ActivityDocument>> {
    const { task } = await this.taskAccess.requireTask(ctx, idOrCustomId, 'view', {
      includeDeleted: true,
    });

    return this.page({ workspaceId: ctx.workspaceId, taskId: task._id }, query);
  }

  /** Activity view of the workspace, limited to the Lists the requester can see. */
  async forWorkspace(
    ctx: PermissionContext,
    query: ActivityQueryDto,
  ): Promise<CursorPage<ActivityDocument>> {
    const listIds = await this.taskAccess.visibleListIds(ctx, query.location, query.locationId);

    if (listIds.length === 0) {
      return { items: [], nextCursor: null };
    }

    return this.page({ workspaceId: ctx.workspaceId, listId: { $in: listIds } }, query);
  }

  private async page(
    filter: Record<string, unknown>,
    query: PaginationQueryDto,
  ): Promise<CursorPage<ActivityDocument>> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const after = query.cursor ? decodeObjectIdCursor(query.cursor) : null;
    const docs = await this.model
      .find(after ? { ...filter, _id: { $lt: after } } : filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .exec();

    return buildCursorPage(docs, limit, (doc) => ({ id: String(doc._id) }));
  }
}

function toChangeList(changes: TaskChanges | undefined) {
  return Object.entries(changes ?? {}).map(([field, change]) => ({
    field,
    from: change.from,
    to: change.to,
  }));
}
