import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage, buildCursorPage, decodeObjectIdCursor } from '../../common/pagination/cursor';
import { DEFAULT_PAGE_SIZE } from '../../common/pagination/pagination-query.dto';
import { PermissionContext } from '../hierarchy/permission.service';
import { Task } from '../tasks/schemas/task.schema';
import { TaskAccessService } from '../tasks/task-access.service';
import { hasRoleAtLeast } from '../workspaces/workspace-roles';
import {
  CreateTimeEntryDto,
  MAX_DURATION_MINUTES,
  StartTimerDto,
  TimeEntryQueryDto,
  UpdateTimeEntryDto,
} from './dto/time-entry.dto';
import { TimeEntry, TimeEntryDocument } from './schemas/time-entry.schema';
import {
  TIME_ENTRY_CREATED,
  TIME_ENTRY_DELETED,
  TIME_ENTRY_UPDATED,
  TimeEntryEvent,
} from './time-events';
import { EDITABLE_APPROVAL_STATUSES, MAX_TIME_ENTRIES, minutesBetween } from './time-fields';

/** The entry that was started plus the one the start had to stop, if any. */
export interface TimerResult {
  entry: TimeEntryDocument;
  stopped: TimeEntryDocument | null;
}

interface Interval {
  start: Date;
  end: Date | null;
  durationMinutes: number;
}

@Injectable()
export class TimeEntriesService {
  constructor(
    @InjectModel(TimeEntry.name) private readonly model: Model<TimeEntry>,
    @InjectModel(Task.name) private readonly tasks: Model<Task>,
    private readonly taskAccess: TaskAccessService,
    private readonly events: EventEmitter2,
  ) {}

  entryNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'TIME_ENTRY_NOT_FOUND',
      message: 'Lançamento de tempo não encontrado.',
    });
  }

  /** Starting a timer stops the one already running for the same user. */
  async startTimer(ctx: PermissionContext, dto: StartTimerDto): Promise<TimerResult> {
    const { task } = await this.taskAccess.requireTask(ctx, dto.taskId, 'view');
    const now = new Date();
    const stopped = await this.stopRunning(ctx, now);
    const entry = await this.model.create({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      taskId: task._id,
      start: now,
      end: null,
      durationMinutes: 0,
      source: 'timer',
    });

    this.emit(TIME_ENTRY_CREATED, ctx, entry);

    return { entry, stopped };
  }

  async stopTimer(ctx: PermissionContext): Promise<TimeEntryDocument> {
    const stopped = await this.stopRunning(ctx, new Date());

    if (!stopped) {
      throw new NotFoundException({
        code: 'TIMER_NOT_RUNNING',
        message: 'Nenhum cronômetro em andamento.',
      });
    }

    return stopped;
  }

  /** The running entry of the requester, or null. */
  currentTimer(ctx: PermissionContext): Promise<TimeEntryDocument | null> {
    return this.model
      .findOne({ workspaceId: ctx.workspaceId, userId: ctx.userId, end: null })
      .sort({ start: -1 })
      .exec();
  }

  async create(ctx: PermissionContext, dto: CreateTimeEntryDto): Promise<TimeEntryDocument> {
    const { task } = await this.taskAccess.requireTask(ctx, dto.taskId, 'view');
    const interval = this.intervalOf(new Date(dto.start), dto.end, dto.durationMinutes);
    const entry = await this.model.create({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      taskId: task._id,
      ...interval,
      billable: dto.billable ?? false,
      note: dto.note ?? '',
      source: 'manual',
    });

    await this.syncTracked(ctx.workspaceId, task._id);
    this.emit(TIME_ENTRY_CREATED, ctx, entry);

    return entry;
  }

  async list(
    ctx: PermissionContext,
    query: TimeEntryQueryDto,
  ): Promise<CursorPage<TimeEntryDocument>> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const userId = this.resolveUserId(ctx, query.userId);
    const start = this.rangeFilter(query.from, query.to);
    const base = {
      workspaceId: ctx.workspaceId,
      userId,
      ...(query.taskId ? { taskId: new Types.ObjectId(query.taskId) } : {}),
      ...(start ? { start } : {}),
    };

    const docs = await this.model
      .find(query.cursor ? { ...base, _id: { $lt: decodeObjectIdCursor(query.cursor) } } : base)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .exec();

    return buildCursorPage(docs, limit, (doc) => ({ id: String(doc._id) }));
  }

  async update(
    ctx: PermissionContext,
    entryId: Types.ObjectId,
    dto: UpdateTimeEntryDto,
  ): Promise<TimeEntryDocument> {
    const entry = await this.requireWritable(ctx, entryId);
    const changesInterval =
      dto.start !== undefined || dto.end !== undefined || dto.durationMinutes !== undefined;

    if (changesInterval) {
      const interval = this.intervalOf(
        dto.start ? new Date(dto.start) : entry.start,
        dto.end,
        dto.durationMinutes ?? (dto.end === undefined ? entry.durationMinutes : undefined),
      );

      entry.start = interval.start;
      entry.end = interval.end;
      entry.durationMinutes = interval.durationMinutes;
    }

    if (dto.billable !== undefined) {
      entry.billable = dto.billable;
    }

    if (dto.note !== undefined) {
      entry.note = dto.note;
    }

    await entry.save();
    await this.syncTracked(ctx.workspaceId, entry.taskId);
    this.emit(TIME_ENTRY_UPDATED, ctx, entry);

    return entry;
  }

  async remove(ctx: PermissionContext, entryId: Types.ObjectId): Promise<void> {
    const entry = await this.requireWritable(ctx, entryId);

    await entry.deleteOne();
    await this.syncTracked(ctx.workspaceId, entry.taskId);
    this.emit(TIME_ENTRY_DELETED, ctx, entry);
  }

  /** Entries of a window, used by the timesheet and by the dashboard cards. */
  find(filter: Record<string, unknown>): Promise<TimeEntryDocument[]> {
    return this.model.find(filter).sort({ start: 1 }).limit(MAX_TIME_ENTRIES).exec();
  }

  /** Only an admin reads or writes the time of someone else. */
  resolveUserId(ctx: PermissionContext, userId?: string): Types.ObjectId {
    if (!userId || userId === String(ctx.userId)) {
      return ctx.userId;
    }

    if (!hasRoleAtLeast(ctx.role, 'admin')) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ROLE',
        message: 'Apenas administradores veem o tempo de outras pessoas.',
      });
    }

    return new Types.ObjectId(userId);
  }

  /** Recomputes `trackedMinutes` of the task from its entries. */
  async syncTracked(workspaceId: Types.ObjectId, taskId: Types.ObjectId): Promise<void> {
    const rows = await this.model
      .aggregate<{ total: number }>([
        { $match: { workspaceId, taskId } },
        { $group: { _id: null, total: { $sum: '$durationMinutes' } } },
      ])
      .exec();

    await this.tasks
      .updateOne({ _id: taskId, workspaceId }, { $set: { trackedMinutes: rows[0]?.total ?? 0 } })
      .exec();
  }

  private async stopRunning(ctx: PermissionContext, at: Date): Promise<TimeEntryDocument | null> {
    const running = await this.currentTimer(ctx);

    if (!running) {
      return null;
    }

    running.end = at;
    running.durationMinutes = Math.max(0, minutesBetween(running.start, at));

    await running.save();
    await this.syncTracked(ctx.workspaceId, running.taskId);
    this.emit(TIME_ENTRY_UPDATED, ctx, running);

    return running;
  }

  private async requireWritable(
    ctx: PermissionContext,
    entryId: Types.ObjectId,
  ): Promise<TimeEntryDocument> {
    const entry = await this.model.findOne({ _id: entryId, workspaceId: ctx.workspaceId }).exec();
    const isAdmin = hasRoleAtLeast(ctx.role, 'admin');

    if (!entry || (String(entry.userId) !== String(ctx.userId) && !isAdmin)) {
      throw this.entryNotFound();
    }

    if (!EDITABLE_APPROVAL_STATUSES.includes(entry.approvalStatus) && !isAdmin) {
      throw new BadRequestException({
        code: 'TIME_ENTRY_LOCKED',
        message: 'Lançamento enviado para aprovação não pode ser alterado.',
      });
    }

    return entry;
  }

  /** Accepts an end, a duration or both, and keeps the two consistent. */
  private intervalOf(start: Date, end?: string, durationMinutes?: number): Interval {
    if (end !== undefined) {
      const endDate = new Date(end);
      const minutes = minutesBetween(start, endDate);

      if (minutes <= 0) {
        throw this.invalidInterval('O fim precisa ser depois do início.');
      }

      this.assertDuration(minutes);

      return { start, end: endDate, durationMinutes: minutes };
    }

    if (durationMinutes === undefined || durationMinutes <= 0) {
      throw this.invalidInterval('Informe o fim ou a duração em minutos.');
    }

    this.assertDuration(durationMinutes);

    return { start, end: new Date(start.getTime() + durationMinutes * 60_000), durationMinutes };
  }

  private assertDuration(minutes: number): void {
    if (minutes > MAX_DURATION_MINUTES) {
      throw this.invalidInterval('Um lançamento não pode passar de 24 horas.');
    }
  }

  private invalidInterval(message: string): BadRequestException {
    return new BadRequestException({ code: 'INVALID_TIME_ENTRY', message });
  }

  private rangeFilter(from?: string, to?: string): Record<string, Date> | null {
    if (!from && !to) {
      return null;
    }

    return {
      ...(from ? { $gte: new Date(from) } : {}),
      ...(to ? { $lt: new Date(to) } : {}),
    };
  }

  private emit(event: string, ctx: PermissionContext, entry: TimeEntryDocument): void {
    const payload: TimeEntryEvent = {
      workspaceId: ctx.workspaceId,
      entryId: entry._id,
      taskId: entry.taskId,
      userId: entry.userId,
      actorId: ctx.userId,
      durationMinutes: entry.durationMinutes,
    };

    this.events.emit(event, payload);
  }
}
