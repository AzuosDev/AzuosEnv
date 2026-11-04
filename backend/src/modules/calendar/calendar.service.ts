import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PermissionContext } from '../hierarchy/permission.service';
import { TaskAccessService } from '../tasks/task-access.service';
import { MembersService } from '../workspaces/members.service';
import { MAX_EVENTS_PER_RANGE, MAX_RANGE_DAYS } from './calendar-fields';
import {
  CalendarRangeDto,
  CreateCalendarEventDto,
  UpdateCalendarEventDto,
} from './dto/calendar-event.dto';
import { CalendarEvent, CalendarEventDocument } from './schemas/calendar-event.schema';

export interface DateRange {
  from: Date;
  to: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Events of the calendar of a member. An event belongs to the user that created
 * it; the attendees only see it, so only the owner edits or deletes it.
 */
@Injectable()
export class CalendarService {
  constructor(
    @InjectModel(CalendarEvent.name) private readonly model: Model<CalendarEvent>,
    private readonly taskAccess: TaskAccessService,
    private readonly members: MembersService,
  ) {}

  eventNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'CALENDAR_EVENT_NOT_FOUND',
      message: 'Evento não encontrado.',
    });
  }

  async create(
    ctx: PermissionContext,
    dto: CreateCalendarEventDto,
  ): Promise<CalendarEventDocument> {
    const interval = this.requireInterval(dto.start, dto.end);

    return this.model.create({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      title: dto.title,
      start: interval.start,
      end: interval.end,
      allDay: dto.allDay ?? false,
      attendeeIds: await this.requireAttendees(ctx, dto.attendeeIds),
      taskId: dto.taskId ? await this.requireTask(ctx, dto.taskId) : null,
      meetUrl: dto.meetUrl ?? null,
      recurrence: dto.recurrence ?? null,
      source: 'local',
      externalId: null,
    });
  }

  /** Events of the requester (owned or attended) that touch the period. */
  list(ctx: PermissionContext, query: CalendarRangeDto): Promise<CalendarEventDocument[]> {
    return this.inRange(ctx, this.requireRange(query));
  }

  async get(ctx: PermissionContext, eventId: Types.ObjectId): Promise<CalendarEventDocument> {
    const event = await this.model
      .findOne({
        _id: eventId,
        workspaceId: ctx.workspaceId,
        $or: [{ userId: ctx.userId }, { attendeeIds: ctx.userId }],
      })
      .exec();

    if (!event) {
      throw this.eventNotFound();
    }

    return event;
  }

  async update(
    ctx: PermissionContext,
    eventId: Types.ObjectId,
    dto: UpdateCalendarEventDto,
  ): Promise<CalendarEventDocument> {
    const event = await this.requireOwned(ctx, eventId);
    const interval = this.requireInterval(
      dto.start ?? event.start.toISOString(),
      dto.end ?? event.end.toISOString(),
    );

    event.start = interval.start;
    event.end = interval.end;

    if (dto.title !== undefined) {
      event.title = dto.title;
    }

    if (dto.allDay !== undefined) {
      event.allDay = dto.allDay;
    }

    if (dto.attendeeIds !== undefined) {
      event.attendeeIds = await this.requireAttendees(ctx, dto.attendeeIds);
    }

    if (dto.taskId !== undefined) {
      event.taskId = dto.taskId ? await this.requireTask(ctx, dto.taskId) : null;
    }

    if (dto.meetUrl !== undefined) {
      event.meetUrl = dto.meetUrl ?? null;
    }

    if (dto.recurrence !== undefined) {
      event.recurrence = dto.recurrence ?? null;
    }

    return event.save();
  }

  async remove(ctx: PermissionContext, eventId: Types.ObjectId): Promise<void> {
    const event = await this.requireOwned(ctx, eventId);

    await this.model.deleteOne({ _id: event._id }).exec();
  }

  /** Time block of a task, used by the planner. */
  async createBlock(
    ctx: PermissionContext,
    taskId: string,
    start: string,
    end: string,
  ): Promise<CalendarEventDocument> {
    const { task } = await this.taskAccess.requireTask(ctx, taskId, 'view');
    const interval = this.requireInterval(start, end);

    return this.model.create({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      title: task.name,
      start: interval.start,
      end: interval.end,
      allDay: false,
      attendeeIds: [],
      taskId: task._id,
      meetUrl: null,
      recurrence: null,
      source: 'local',
      externalId: null,
    });
  }

  /** Events of the requester inside the period, earliest first. */
  inRange(ctx: PermissionContext, range: DateRange): Promise<CalendarEventDocument[]> {
    return this.model
      .find({
        workspaceId: ctx.workspaceId,
        $or: [{ userId: ctx.userId }, { attendeeIds: ctx.userId }],
        start: { $lt: range.to },
        end: { $gt: range.from },
      })
      .sort({ start: 1 })
      .limit(MAX_EVENTS_PER_RANGE)
      .exec();
  }

  /** Ids of the tasks the requester already blocked time for. */
  async blockedTaskIds(ctx: PermissionContext): Promise<Types.ObjectId[]> {
    const ids: unknown[] = await this.model
      .distinct('taskId', {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        taskId: { $ne: null },
      })
      .exec();

    return ids.filter((id): id is Types.ObjectId => id instanceof Types.ObjectId);
  }

  requireRange(query: CalendarRangeDto): DateRange {
    const from = new Date(query.from);
    const to = new Date(query.to);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'Informe um período válido (to depois de from).',
      });
    }

    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_MS) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'O período do planner é de no máximo 120 dias.',
      });
    }

    return { from, to };
  }

  private async requireOwned(
    ctx: PermissionContext,
    eventId: Types.ObjectId,
  ): Promise<CalendarEventDocument> {
    const event = await this.model
      .findOne({ _id: eventId, workspaceId: ctx.workspaceId, userId: ctx.userId })
      .exec();

    if (!event) {
      throw this.eventNotFound();
    }

    return event;
  }

  private requireInterval(start: string, end: string): { start: Date; end: Date } {
    const startAt = new Date(start);
    const endAt = new Date(end);

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
      throw new BadRequestException({
        code: 'INVALID_EVENT_RANGE',
        message: 'O fim do evento precisa ser depois do início.',
      });
    }

    return { start: startAt, end: endAt };
  }

  private async requireAttendees(
    ctx: PermissionContext,
    attendeeIds: string[] | undefined,
  ): Promise<Types.ObjectId[]> {
    if (!attendeeIds?.length) {
      return [];
    }

    const ids = [...new Set(attendeeIds)].map((id) => new Types.ObjectId(id));
    const active = await this.members.activeUserIds(ctx.workspaceId, ids);

    if (active.length !== ids.length) {
      throw new BadRequestException({
        code: 'INVALID_ATTENDEES',
        message: 'Um ou mais convidados não são membros ativos deste workspace.',
      });
    }

    return ids;
  }

  private async requireTask(ctx: PermissionContext, taskId: string): Promise<Types.ObjectId> {
    const { task } = await this.taskAccess.requireTask(ctx, taskId, 'view');

    return task._id;
  }
}
