import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { startOfZonedDayKey } from '../../common/utils/timezone';
import { PermissionContext } from '../hierarchy/permission.service';
import { Task } from '../tasks/schemas/task.schema';
import { TaskAccessService } from '../tasks/task-access.service';
import { UsersService } from '../users/users.service';
import { MembersService } from '../workspaces/members.service';
import { WorkloadQueryDto } from './dto/workload.dto';
import { TimeEntry } from './schemas/time-entry.schema';
import { WorkloadMetric, toHours } from './time-fields';
import { addDaysToKey, dayKeysBetween } from './week';

export interface WorkloadMember {
  userId: string;
  name: string;
  capacityPerDay: number;
  capacity: number;
  total: number;
  byDay: Record<string, number>;
}

export interface WorkloadResult {
  from: string;
  to: string;
  metric: WorkloadMetric;
  timezone: string;
  days: string[];
  members: WorkloadMember[];
}

interface WorkloadRow {
  _id: { userId: Types.ObjectId; day: string };
  value: number;
}

/** Value per person and day against the capacity of each member. */
@Injectable()
export class WorkloadService {
  constructor(
    @InjectModel(Task.name) private readonly tasks: Model<Task>,
    @InjectModel(TimeEntry.name) private readonly entries: Model<TimeEntry>,
    private readonly taskAccess: TaskAccessService,
    private readonly members: MembersService,
    private readonly users: UsersService,
  ) {}

  async workload(
    ctx: PermissionContext,
    timezone: string,
    query: WorkloadQueryDto,
  ): Promise<WorkloadResult> {
    const metric = query.metric ?? 'tasks';
    const days = dayKeysBetween(query.from, query.to);
    const start = startOfZonedDayKey(query.from, timezone);
    const end = startOfZonedDayKey(addDaysToKey(query.to, 1), timezone);
    const listIds = await this.taskAccess.visibleListIds(ctx, query.location, query.locationId);
    const rows =
      listIds.length === 0 ? [] : await this.rows(ctx, metric, timezone, listIds, start, end);

    const members = await this.members.activeMembersOf(ctx.workspaceId);
    const names = await this.users.namesByIds(members.map((member) => member.userId));
    const byUser = new Map<string, WorkloadRow[]>();

    for (const row of rows) {
      const key = String(row._id.userId);

      byUser.set(key, [...(byUser.get(key) ?? []), row]);
    }

    return {
      from: query.from,
      to: query.to,
      metric,
      timezone,
      days,
      members: members.map((member) => {
        const userId = String(member.userId);
        const byDay: Record<string, number> = Object.fromEntries(days.map((day) => [day, 0]));
        let total = 0;

        for (const row of byUser.get(userId) ?? []) {
          if (byDay[row._id.day] === undefined) {
            continue;
          }

          const value = metric === 'hours' ? toHours(row.value) : row.value;

          byDay[row._id.day] += value;
          total += value;
        }

        return {
          userId,
          name: names.get(userId) ?? '',
          capacityPerDay: member.capacityPerDay,
          capacity: member.capacityPerDay * days.length,
          total: Math.round(total * 100) / 100,
          byDay,
        };
      }),
    };
  }

  private rows(
    ctx: PermissionContext,
    metric: WorkloadMetric,
    timezone: string,
    listIds: Types.ObjectId[],
    start: Date,
    end: Date,
  ): Promise<WorkloadRow[]> {
    if (metric === 'hours') {
      return this.entries
        .aggregate<WorkloadRow>([
          { $match: { workspaceId: ctx.workspaceId, start: { $gte: start, $lt: end } } },
          {
            $lookup: {
              from: 'tasks',
              localField: 'taskId',
              foreignField: '_id',
              as: 'task',
            },
          },
          { $unwind: '$task' },
          { $match: { 'task.listIds': { $in: listIds }, 'task.deletedAt': null } },
          {
            $group: {
              _id: { userId: '$userId', day: this.dayOf('$start', timezone) },
              value: { $sum: '$durationMinutes' },
            },
          },
        ])
        .exec();
    }

    const _id = { userId: '$assigneeIds', day: this.dayOf('$dueAt', timezone) };
    const group: PipelineStage.Group =
      metric === 'points'
        ? { $group: { _id, value: { $sum: { $ifNull: ['$points', 0] } } } }
        : { $group: { _id, value: { $sum: 1 } } };

    return this.tasks
      .aggregate<WorkloadRow>([
        {
          $match: {
            workspaceId: ctx.workspaceId,
            listIds: { $in: listIds },
            deletedAt: null,
            archivedAt: null,
            dueAt: { $gte: start, $lt: end },
          },
        },
        { $unwind: '$assigneeIds' },
        group,
      ])
      .exec();
  }

  private dayOf(field: string, timezone: string): Record<string, unknown> {
    return { $dateToString: { date: field, format: '%Y-%m-%d', timezone } };
  }
}
