import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PermissionContext } from '../hierarchy/permission.service';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';
import { TaskAccessService } from '../tasks/task-access.service';
import { CalendarService } from './calendar.service';
import { CLOSED_STATUS_GROUPS, MAX_PLANNER_TASKS } from './calendar-fields';
import { CalendarRangeDto, CreateTimeBlockDto } from './dto/calendar-event.dto';
import { CalendarEventDocument } from './schemas/calendar-event.schema';

/** The day of the member: agenda, what is due and what still has no block. */
export interface PlannerResult {
  from: string;
  to: string;
  events: CalendarEventDocument[];
  dueTasks: TaskDocument[];
  unscheduledTasks: TaskDocument[];
}

@Injectable()
export class PlannerService {
  constructor(
    @InjectModel(Task.name) private readonly tasks: Model<Task>,
    private readonly calendar: CalendarService,
    private readonly taskAccess: TaskAccessService,
  ) {}

  async planner(ctx: PermissionContext, query: CalendarRangeDto): Promise<PlannerResult> {
    const range = this.calendar.requireRange(query);
    const listIds = await this.taskAccess.visibleListIds(ctx);
    const events = await this.calendar.inRange(ctx, range);
    const blocked = await this.calendar.blockedTaskIds(ctx);

    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      events,
      dueTasks: await this.dueTasks(ctx, listIds, range.from, range.to),
      unscheduledTasks: await this.unscheduledTasks(ctx, listIds, blocked),
    };
  }

  /** Books a slot for a task of the requester; the block is a calendar event. */
  block(ctx: PermissionContext, dto: CreateTimeBlockDto): Promise<CalendarEventDocument> {
    return this.calendar.createBlock(ctx, dto.taskId, dto.start, dto.end);
  }

  /** Open tasks of the requester with a due date inside the period. */
  private dueTasks(
    ctx: PermissionContext,
    listIds: Types.ObjectId[],
    from: Date,
    to: Date,
  ): Promise<TaskDocument[]> {
    return this.tasks
      .find({
        ...this.mineFilter(ctx, listIds),
        dueAt: { $gte: from, $lt: to },
      })
      .sort({ dueAt: 1 })
      .limit(MAX_PLANNER_TASKS)
      .exec();
  }

  /** Open tasks of the requester that have no time block yet. */
  private unscheduledTasks(
    ctx: PermissionContext,
    listIds: Types.ObjectId[],
    blocked: Types.ObjectId[],
  ): Promise<TaskDocument[]> {
    return this.tasks
      .find({
        ...this.mineFilter(ctx, listIds),
        ...(blocked.length ? { _id: { $nin: blocked } } : {}),
      })
      .sort({ dueAt: 1, _id: 1 })
      .limit(MAX_PLANNER_TASKS)
      .exec();
  }

  private mineFilter(ctx: PermissionContext, listIds: Types.ObjectId[]): Record<string, unknown> {
    return {
      workspaceId: ctx.workspaceId,
      listIds: { $in: listIds },
      assigneeIds: ctx.userId,
      statusGroup: { $nin: [...CLOSED_STATUS_GROUPS] },
      deletedAt: null,
      archivedAt: null,
    };
  }
}
