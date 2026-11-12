import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CSV_CONTENT_TYPE, CsvCell, toCsvBuffer } from '../../common/utils/csv';
import { slugify } from '../../common/utils/slug';
import { startOfZonedDayKey, zonedDateKey } from '../../common/utils/timezone';
import { PermissionContext } from '../hierarchy/permission.service';
import { Task } from '../tasks/schemas/task.schema';
import { UsersService } from '../users/users.service';
import { ClientsService } from './clients.service';
import { ApprovalsQueryDto, ReviewTimesheetDto, TimesheetQueryDto } from './dto/timesheet.dto';
import { TimeEntry, TimeEntryDocument } from './schemas/time-entry.schema';
import { TimeEntriesService } from './time-entries.service';
import { TIMESHEET_REVIEWED, TIMESHEET_SUBMITTED, TimesheetEvent } from './time-events';
import { ApprovalStatus, toHours } from './time-fields';
import { addDaysToKey, weekDayKeys, weekStartOf } from './week';

/** One task of the week, with the minutes of each day. */
export interface TimesheetRow {
  taskId: string;
  customId: string;
  name: string;
  listId: string;
  listName: string;
  client: string;
  minutes: Record<string, number>;
  total: number;
  billableMinutes: number;
}

export interface Timesheet {
  userId: string;
  timezone: string;
  weekStart: string;
  weekEnd: string;
  days: string[];
  rows: TimesheetRow[];
  totals: { byDay: Record<string, number>; total: number; billableMinutes: number };
  approvalStatus: ApprovalStatus;
  entries: number;
}

/** A week waiting for the admin to approve or reject. */
export interface TimesheetApproval {
  userId: string;
  name: string;
  weekStart: string;
  totalMinutes: number;
  billableMinutes: number;
  entries: number;
}

export interface TimesheetExport {
  filename: string;
  contentType: string;
  body: Buffer;
}

export interface ReviewResult {
  userId: string;
  weekStart: string;
  approvalStatus: ApprovalStatus;
  updated: number;
}

@Injectable()
export class TimesheetsService {
  constructor(
    @InjectModel(TimeEntry.name) private readonly model: Model<TimeEntry>,
    @InjectModel(Task.name) private readonly tasks: Model<Task>,
    private readonly entries: TimeEntriesService,
    private readonly clients: ClientsService,
    private readonly users: UsersService,
    private readonly events: EventEmitter2,
  ) {}

  /** Grid of task × day for the week, with the client of each task. */
  async grid(
    ctx: PermissionContext,
    timezone: string,
    query: TimesheetQueryDto,
  ): Promise<Timesheet> {
    const userId = this.entries.resolveUserId(ctx, query.userId);
    const weekStart = this.weekStartOf(query.weekStart, timezone);
    const days = weekDayKeys(weekStart);
    const docs = await this.entries.find({
      workspaceId: ctx.workspaceId,
      userId,
      ...this.weekFilter(weekStart, timezone),
    });

    const tasks = await this.tasks
      .find({ workspaceId: ctx.workspaceId, _id: { $in: docs.map((doc) => doc.taskId) } })
      .select('name customId listId')
      .exec();

    const byTask = new Map(tasks.map((task) => [String(task._id), task]));
    const clients = await this.clients.forLists(
      ctx.workspaceId,
      tasks.map((task) => task.listId),
    );

    const rows = new Map<string, TimesheetRow>();
    const byDay: Record<string, number> = Object.fromEntries(days.map((day) => [day, 0]));
    let total = 0;
    let billableMinutes = 0;

    for (const doc of docs) {
      const task = byTask.get(String(doc.taskId));

      if (!task) {
        continue;
      }

      const client = clients.get(String(task.listId));
      const row =
        rows.get(String(task._id)) ??
        ({
          taskId: String(task._id),
          customId: task.customId,
          name: task.name,
          listId: String(task.listId),
          listName: client?.listName ?? '',
          client: client?.client ?? '',
          minutes: Object.fromEntries(days.map((day) => [day, 0])),
          total: 0,
          billableMinutes: 0,
        } satisfies TimesheetRow);

      const day = zonedDateKey(doc.start, timezone);

      if (row.minutes[day] === undefined) {
        continue;
      }

      row.minutes[day] += doc.durationMinutes;
      row.total += doc.durationMinutes;
      byDay[day] += doc.durationMinutes;
      total += doc.durationMinutes;

      if (doc.billable) {
        row.billableMinutes += doc.durationMinutes;
        billableMinutes += doc.durationMinutes;
      }

      rows.set(row.taskId, row);
    }

    return {
      userId: String(userId),
      timezone,
      weekStart,
      weekEnd: addDaysToKey(weekStart, 6),
      days,
      rows: [...rows.values()].sort((a, b) => a.customId.localeCompare(b.customId)),
      totals: { byDay, total, billableMinutes },
      approvalStatus: weekStatus(docs),
      entries: docs.length,
    };
  }

  /** Sends the own week for approval; a running timer stays out. */
  async submit(
    ctx: PermissionContext,
    timezone: string,
    weekStartInput: string,
  ): Promise<{ weekStart: string; approvalStatus: ApprovalStatus; updated: number }> {
    const weekStart = this.weekStartOf(weekStartInput, timezone);
    const result = await this.model
      .updateMany(
        {
          workspaceId: ctx.workspaceId,
          userId: ctx.userId,
          end: { $ne: null },
          approvalStatus: { $in: ['draft', 'rejected'] },
          ...this.weekFilter(weekStart, timezone),
        },
        { $set: { approvalStatus: 'submitted', approvedBy: null } },
      )
      .exec();

    this.emit(TIMESHEET_SUBMITTED, ctx, ctx.userId, weekStart, 'submitted', result.modifiedCount);

    return { weekStart, approvalStatus: 'submitted', updated: result.modifiedCount };
  }

  /** Weeks submitted and still waiting, newest first. */
  async approvals(
    ctx: PermissionContext,
    timezone: string,
    query: ApprovalsQueryDto,
  ): Promise<{ items: TimesheetApproval[] }> {
    const docs = await this.entries.find({
      workspaceId: ctx.workspaceId,
      approvalStatus: 'submitted',
      ...(query.userId ? { userId: new Types.ObjectId(query.userId) } : {}),
      ...(query.weekStart ? this.weekFilter(weekStartOf(query.weekStart), timezone) : {}),
    });

    const grouped = new Map<string, TimesheetApproval>();

    for (const doc of docs) {
      const weekStart = weekStartOf(zonedDateKey(doc.start, timezone));
      const key = `${String(doc.userId)}:${weekStart}`;
      const item = grouped.get(key) ?? {
        userId: String(doc.userId),
        name: '',
        weekStart,
        totalMinutes: 0,
        billableMinutes: 0,
        entries: 0,
      };

      item.totalMinutes += doc.durationMinutes;
      item.billableMinutes += doc.billable ? doc.durationMinutes : 0;
      item.entries += 1;
      grouped.set(key, item);
    }

    const names = await this.users.namesByIds(
      [...new Set([...grouped.values()].map((item) => item.userId))].map(
        (id) => new Types.ObjectId(id),
      ),
    );

    const items = [...grouped.values()].map((item) => ({
      ...item,
      name: names.get(item.userId) ?? '',
    }));

    items.sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.name.localeCompare(b.name));

    return { items };
  }

  /** Approves or rejects every submitted entry of that person in that week. */
  async review(
    ctx: PermissionContext,
    timezone: string,
    dto: ReviewTimesheetDto,
    approvalStatus: Extract<ApprovalStatus, 'approved' | 'rejected'>,
  ): Promise<ReviewResult> {
    const weekStart = weekStartOf(dto.weekStart);
    const result = await this.model
      .updateMany(
        {
          workspaceId: ctx.workspaceId,
          userId: new Types.ObjectId(dto.userId),
          approvalStatus: 'submitted',
          ...this.weekFilter(weekStart, timezone),
        },
        { $set: { approvalStatus, approvedBy: ctx.userId } },
      )
      .exec();

    if (result.matchedCount === 0) {
      throw new NotFoundException({
        code: 'TIMESHEET_NOT_FOUND',
        message: 'Nenhuma semana enviada para aprovação.',
      });
    }

    this.emit(
      TIMESHEET_REVIEWED,
      ctx,
      new Types.ObjectId(dto.userId),
      weekStart,
      approvalStatus,
      result.modifiedCount,
    );

    return { userId: dto.userId, weekStart, approvalStatus, updated: result.modifiedCount };
  }

  async exportCsv(
    ctx: PermissionContext,
    timezone: string,
    query: TimesheetQueryDto,
  ): Promise<TimesheetExport> {
    const sheet = await this.grid(ctx, timezone, query);
    const columns = ['Cliente', 'ID', 'Tarefa', ...sheet.days, 'Total (h)'];
    const rows: CsvCell[][] = sheet.rows.map((row) => [
      row.client,
      row.customId,
      row.name,
      ...sheet.days.map((day) => toHours(row.minutes[day] ?? 0)),
      toHours(row.total),
    ]);

    rows.push([
      'Total',
      '',
      '',
      ...sheet.days.map((day) => toHours(sheet.totals.byDay[day] ?? 0)),
      toHours(sheet.totals.total),
    ]);

    return {
      filename: `timesheet-${slugify(sheet.weekStart)}.csv`,
      contentType: CSV_CONTENT_TYPE,
      body: toCsvBuffer(columns, rows),
    };
  }

  private weekStartOf(weekStart: string | undefined, timezone: string): string {
    return weekStartOf(weekStart ?? zonedDateKey(new Date(), timezone));
  }

  private weekFilter(weekStart: string, timezone: string): Record<string, unknown> {
    return {
      start: {
        $gte: startOfZonedDayKey(weekStart, timezone),
        $lt: startOfZonedDayKey(addDaysToKey(weekStart, 7), timezone),
      },
    };
  }

  private emit(
    event: string,
    ctx: PermissionContext,
    userId: Types.ObjectId,
    weekStart: string,
    status: ApprovalStatus,
    entries: number,
  ): void {
    const payload: TimesheetEvent = {
      workspaceId: ctx.workspaceId,
      userId,
      actorId: ctx.userId,
      weekStart,
      status,
      entries,
    };

    this.events.emit(event, payload);
  }
}

/** The week is only approved when every entry of it is. */
function weekStatus(docs: TimeEntryDocument[]): ApprovalStatus {
  const statuses = new Set(docs.map((doc) => doc.approvalStatus));

  if (docs.length === 0 || statuses.has('draft')) {
    return 'draft';
  }

  if (statuses.has('rejected')) {
    return 'rejected';
  }

  return statuses.has('submitted') ? 'submitted' : 'approved';
}
