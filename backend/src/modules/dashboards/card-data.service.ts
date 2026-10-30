import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { startOfZonedDayKey } from '../../common/utils/timezone';
import { PermissionContext } from '../hierarchy/permission.service';
import { StatusSetsService } from '../hierarchy/status-sets.service';
import { Task } from '../tasks/schemas/task.schema';
import { TaskAccessService } from '../tasks/task-access.service';
import { ClientsService } from '../time/clients.service';
import { TimeEntry } from '../time/schemas/time-entry.schema';
import { toHours } from '../time/time-fields';
import { addDaysToKey, dayKeysBetween } from '../time/week';
import { WorkloadService } from '../time/workload.service';
import { UsersService } from '../users/users.service';
import { burndownSeries, burnupSeries, idealSeries } from './burn';
import { CardConfigDto } from './dto/dashboard.dto';
import { CalculatorOp, CardType, DEFAULT_CARD_LIMIT } from './dashboard-cards';

export type CardData = Record<string, unknown>;

interface CountRow {
  _id: Types.ObjectId | null;
  count: number;
}

interface DayRow {
  _id: string;
  count: number;
}

interface MinutesRow {
  _id: Types.ObjectId | null;
  minutes: number;
  billableMinutes: number;
}

interface Range {
  from: string;
  to: string;
  days: string[];
  start: Date;
  end: Date;
}

const CLOSED_GROUPS = ['done', 'closed'];

/** Group stage of the calculator, summing or averaging the same expression. */
function accumulate(op: CalculatorOp, expression: string): PipelineStage.Group {
  return op === 'avg'
    ? { $group: { _id: null, value: { $avg: expression }, count: { $sum: 1 } } }
    : { $group: { _id: null, value: { $sum: expression }, count: { $sum: 1 } } };
}

/** Runs the aggregation behind each card type. */
@Injectable()
export class CardDataService {
  constructor(
    @InjectModel(Task.name) private readonly tasks: Model<Task>,
    @InjectModel(TimeEntry.name) private readonly entries: Model<TimeEntry>,
    private readonly taskAccess: TaskAccessService,
    private readonly statusSets: StatusSetsService,
    private readonly users: UsersService,
    private readonly clients: ClientsService,
    private readonly workload: WorkloadService,
  ) {}

  async data(
    ctx: PermissionContext,
    timezone: string,
    type: CardType,
    config: CardConfigDto,
  ): Promise<CardData> {
    const listIds = await this.taskAccess.visibleListIds(ctx, config.location, config.locationId);

    switch (type) {
      case 'tasksByStatus':
        return this.tasksByStatus(ctx, listIds, config);
      case 'tasksByAssignee':
        return this.tasksByAssignee(ctx, listIds, config);
      case 'workload':
        return this.workloadCard(ctx, timezone, config);
      case 'burndown':
        return this.burndown(ctx, timezone, listIds, config);
      case 'burnup':
        return this.burnup(ctx, timezone, listIds, config);
      case 'timeByClient':
        return this.timeByClient(ctx, timezone, listIds, config);
      case 'timeByUser':
        return this.timeByUser(ctx, timezone, listIds, config);
      case 'billable':
        return this.billable(ctx, timezone, listIds, config);
      case 'overdueList':
        return this.taskList(ctx, listIds, config, true);
      case 'taskTable':
        return this.taskList(ctx, listIds, config, false);
      default:
        return this.calculator(ctx, listIds, config);
    }
  }

  private async tasksByStatus(
    ctx: PermissionContext,
    listIds: Types.ObjectId[],
    config: CardConfigDto,
  ): Promise<CardData> {
    const rows = await this.tasks
      .aggregate<CountRow>([
        { $match: this.taskMatch(ctx, listIds, config) },
        { $group: { _id: '$statusId', count: { $sum: 1 } } },
      ])
      .exec();

    const statuses = await this.statusSets.statusIndex(ctx.workspaceId);
    const items = rows
      .map((row) => {
        const status = statuses.get(String(row._id));

        return {
          statusId: String(row._id),
          name: status?.name ?? '',
          group: status?.group ?? null,
          position: status?.position ?? 0,
          count: row.count,
        };
      })
      .sort((a, b) => a.position - b.position);

    return { items, total: items.reduce((sum, item) => sum + item.count, 0) };
  }

  private async tasksByAssignee(
    ctx: PermissionContext,
    listIds: Types.ObjectId[],
    config: CardConfigDto,
  ): Promise<CardData> {
    const rows = await this.tasks
      .aggregate<CountRow>([
        { $match: this.taskMatch(ctx, listIds, config) },
        { $unwind: { path: '$assigneeIds', preserveNullAndEmptyArrays: true } },
        { $group: { _id: '$assigneeIds', count: { $sum: 1 } } },
      ])
      .exec();

    const names = await this.users.namesByIds(
      rows.filter((row) => row._id !== null).map((row) => row._id as Types.ObjectId),
    );

    const items = rows
      .map((row) => ({
        userId: row._id === null ? null : String(row._id),
        name: row._id === null ? 'Sem responsável' : (names.get(String(row._id)) ?? ''),
        count: row.count,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    return { items, total: items.reduce((sum, item) => sum + item.count, 0) };
  }

  private async workloadCard(
    ctx: PermissionContext,
    timezone: string,
    config: CardConfigDto,
  ): Promise<CardData> {
    const range = this.requireRange(config);

    return {
      ...(await this.workload.workload(ctx, timezone, {
        from: range.from,
        to: range.to,
        metric: config.metric ?? 'tasks',
        location: config.location,
        locationId: config.locationId,
      })),
    };
  }

  private async burndown(
    ctx: PermissionContext,
    timezone: string,
    listIds: Types.ObjectId[],
    config: CardConfigDto,
  ): Promise<CardData> {
    const range = this.rangeOf(this.requireRange(config), timezone);
    const match = this.taskMatch(ctx, listIds, config);
    const total = await this.tasks.countDocuments(match).exec();
    const closedBefore = await this.tasks
      .countDocuments({ ...match, closedAt: { $ne: null, $lt: range.start } })
      .exec();
    const closedByDay = await this.closedByDay(match, range, timezone);
    const remaining = burndownSeries(range.days, total, closedByDay, closedBefore);

    return {
      days: range.days,
      total,
      remaining,
      ideal: idealSeries(range.days, remaining[0] ?? 0),
    };
  }

  private async burnup(
    ctx: PermissionContext,
    timezone: string,
    listIds: Types.ObjectId[],
    config: CardConfigDto,
  ): Promise<CardData> {
    const range = this.rangeOf(this.requireRange(config), timezone);
    const match = this.taskMatch(ctx, listIds, config);
    const createdBefore = await this.tasks
      .countDocuments({ ...match, createdAt: { $lt: range.start } })
      .exec();
    const closedBefore = await this.tasks
      .countDocuments({ ...match, closedAt: { $ne: null, $lt: range.start } })
      .exec();
    const createdByDay = await this.countByDay(
      { ...match, createdAt: { $gte: range.start, $lt: range.end } },
      '$createdAt',
      timezone,
    );
    const closedByDay = await this.closedByDay(match, range, timezone);

    return {
      days: range.days,
      ...burnupSeries(range.days, createdByDay, closedByDay, createdBefore, closedBefore),
    };
  }

  private async timeByClient(
    ctx: PermissionContext,
    timezone: string,
    listIds: Types.ObjectId[],
    config: CardConfigDto,
  ): Promise<CardData> {
    const rows = await this.minutesBy(ctx, timezone, listIds, config, '$task.listId');
    const clients = await this.clients.forLists(
      ctx.workspaceId,
      rows.filter((row) => row._id !== null).map((row) => row._id as Types.ObjectId),
    );

    const byClient = new Map<
      string,
      { client: string; minutes: number; billableMinutes: number }
    >();

    for (const row of rows) {
      const client = clients.get(String(row._id))?.client ?? 'Sem cliente';
      const item = byClient.get(client) ?? { client, minutes: 0, billableMinutes: 0 };

      item.minutes += row.minutes;
      item.billableMinutes += row.billableMinutes;
      byClient.set(client, item);
    }

    const items = [...byClient.values()]
      .map((item) => ({ ...item, hours: toHours(item.minutes) }))
      .sort((a, b) => b.minutes - a.minutes);

    return { items, totalMinutes: items.reduce((sum, item) => sum + item.minutes, 0) };
  }

  private async timeByUser(
    ctx: PermissionContext,
    timezone: string,
    listIds: Types.ObjectId[],
    config: CardConfigDto,
  ): Promise<CardData> {
    const rows = await this.minutesBy(ctx, timezone, listIds, config, '$userId');
    const names = await this.users.namesByIds(
      rows.filter((row) => row._id !== null).map((row) => row._id as Types.ObjectId),
    );

    const items = rows
      .map((row) => ({
        userId: String(row._id),
        name: names.get(String(row._id)) ?? '',
        minutes: row.minutes,
        billableMinutes: row.billableMinutes,
        hours: toHours(row.minutes),
      }))
      .sort((a, b) => b.minutes - a.minutes);

    return { items, totalMinutes: items.reduce((sum, item) => sum + item.minutes, 0) };
  }

  private async billable(
    ctx: PermissionContext,
    timezone: string,
    listIds: Types.ObjectId[],
    config: CardConfigDto,
  ): Promise<CardData> {
    const rows = await this.minutesBy(ctx, timezone, listIds, config, null);
    const totalMinutes = rows.reduce((sum, row) => sum + row.minutes, 0);
    const billableMinutes = rows.reduce((sum, row) => sum + row.billableMinutes, 0);

    return {
      totalMinutes,
      billableMinutes,
      nonBillableMinutes: totalMinutes - billableMinutes,
      billableHours: toHours(billableMinutes),
      totalHours: toHours(totalMinutes),
      billablePercent: totalMinutes === 0 ? 0 : Math.round((billableMinutes / totalMinutes) * 100),
    };
  }

  private async taskList(
    ctx: PermissionContext,
    listIds: Types.ObjectId[],
    config: CardConfigDto,
    overdueOnly: boolean,
  ): Promise<CardData> {
    const match = overdueOnly
      ? {
          ...this.taskMatch(ctx, listIds, { ...config, includeClosed: false }),
          dueAt: { $ne: null, $lt: new Date() },
        }
      : this.taskMatch(ctx, listIds, config);

    const limit = config.limit ?? DEFAULT_CARD_LIMIT;
    const total = await this.tasks.countDocuments(match).exec();
    const docs = await this.tasks
      .find(match)
      .sort(overdueOnly ? { dueAt: 1 } : { position: 1 })
      .limit(limit)
      .exec();

    const statuses = await this.statusSets.statusIndex(ctx.workspaceId);
    const names = await this.users.namesByIds(docs.flatMap((doc) => doc.assigneeIds));

    return {
      total,
      items: docs.map((doc) => ({
        id: String(doc._id),
        customId: doc.customId,
        name: doc.name,
        status: statuses.get(String(doc.statusId))?.name ?? '',
        statusGroup: doc.statusGroup,
        priority: doc.priority,
        assignees: doc.assigneeIds.map((id) => names.get(String(id)) ?? ''),
        dueAt: doc.dueAt?.toISOString() ?? null,
        points: doc.points,
        estimateMinutes: doc.estimateMinutes,
        trackedMinutes: doc.trackedMinutes,
      })),
    };
  }

  /** Sum or average of a numeric field of the task or of a custom field. */
  private async calculator(
    ctx: PermissionContext,
    listIds: Types.ObjectId[],
    config: CardConfigDto,
  ): Promise<CardData> {
    const op = config.op ?? 'sum';
    const match = this.taskMatch(ctx, listIds, config);

    if (config.taskField) {
      const rows = await this.tasks
        .aggregate<{ value: number; count: number }>([
          { $match: { ...match, [config.taskField]: { $ne: null } } },
          accumulate(op, `$${config.taskField}`),
        ])
        .exec();

      return this.calculatorResult(op, config.taskField, rows[0]);
    }

    if (!config.fieldId) {
      throw new BadRequestException({
        code: 'INVALID_CARD_CONFIG',
        message: 'Informe fieldId ou taskField na calculadora.',
      });
    }

    const fieldId = new Types.ObjectId(config.fieldId);
    const rows = await this.tasks
      .aggregate<{ value: number; count: number }>([
        { $match: { ...match, 'customFields.fieldId': fieldId } },
        { $unwind: '$customFields' },
        { $match: { 'customFields.fieldId': fieldId } },
        {
          $project: {
            value: {
              $convert: { input: '$customFields.value', to: 'double', onError: null, onNull: null },
            },
          },
        },
        { $match: { value: { $ne: null } } },
        accumulate(op, '$value'),
      ])
      .exec();

    return this.calculatorResult(op, config.fieldId, rows[0]);
  }

  private calculatorResult(
    op: string,
    field: string,
    row: { value: number; count: number } | undefined,
  ): CardData {
    return {
      op,
      field,
      count: row?.count ?? 0,
      value: row ? Math.round(row.value * 100) / 100 : 0,
    };
  }

  /** Minutes of the time entries of the window, grouped by `groupBy`. */
  private minutesBy(
    ctx: PermissionContext,
    timezone: string,
    listIds: Types.ObjectId[],
    config: CardConfigDto,
    groupBy: string | null,
  ): Promise<MinutesRow[]> {
    const range =
      config.from && config.to ? this.rangeOf(this.requireRange(config), timezone) : null;

    return this.entries
      .aggregate<MinutesRow>([
        {
          $match: {
            workspaceId: ctx.workspaceId,
            ...(range ? { start: { $gte: range.start, $lt: range.end } } : {}),
          },
        },
        { $lookup: { from: 'tasks', localField: 'taskId', foreignField: '_id', as: 'task' } },
        { $unwind: '$task' },
        { $match: { 'task.listIds': { $in: listIds }, 'task.deletedAt': null } },
        {
          $group: {
            _id: groupBy === null ? null : groupBy,
            minutes: { $sum: '$durationMinutes' },
            billableMinutes: {
              $sum: { $cond: ['$billable', '$durationMinutes', 0] },
            },
          },
        },
      ])
      .exec();
  }

  private closedByDay(
    match: Record<string, unknown>,
    range: Range,
    timezone: string,
  ): Promise<Record<string, number>> {
    return this.countByDay(
      { ...match, closedAt: { $gte: range.start, $lt: range.end } },
      '$closedAt',
      timezone,
    );
  }

  private async countByDay(
    match: Record<string, unknown>,
    field: string,
    timezone: string,
  ): Promise<Record<string, number>> {
    const rows = await this.tasks
      .aggregate<DayRow>([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { date: field, format: '%Y-%m-%d', timezone } },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();

    return Object.fromEntries(rows.map((row) => [row._id, row.count]));
  }

  private taskMatch(
    ctx: PermissionContext,
    listIds: Types.ObjectId[],
    config: CardConfigDto,
  ): Record<string, unknown> {
    return {
      workspaceId: ctx.workspaceId,
      listIds: { $in: listIds },
      deletedAt: null,
      archivedAt: null,
      ...(config.statusIds?.length
        ? { statusId: { $in: config.statusIds.map((id) => new Types.ObjectId(id)) } }
        : {}),
      ...(config.assigneeIds?.length
        ? { assigneeIds: { $in: config.assigneeIds.map((id) => new Types.ObjectId(id)) } }
        : {}),
      ...(config.includeClosed === false ? { statusGroup: { $nin: CLOSED_GROUPS } } : {}),
    };
  }

  private requireRange(config: CardConfigDto): { from: string; to: string } {
    if (!config.from || !config.to) {
      throw new BadRequestException({
        code: 'INVALID_CARD_CONFIG',
        message: 'Informe from e to no card.',
      });
    }

    return { from: config.from, to: config.to };
  }

  private rangeOf(range: { from: string; to: string }, timezone: string): Range {
    return {
      ...range,
      days: dayKeysBetween(range.from, range.to),
      start: startOfZonedDayKey(range.from, timezone),
      end: startOfZonedDayKey(addDaysToKey(range.to, 1), timezone),
    };
  }
}
