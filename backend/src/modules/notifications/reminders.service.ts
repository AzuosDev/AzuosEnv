import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage, buildCursorPage, decodeObjectIdCursor } from '../../common/pagination/cursor';
import { DEFAULT_PAGE_SIZE } from '../../common/pagination/pagination-query.dto';
import { PermissionContext } from '../hierarchy/permission.service';
import { TaskAccessService } from '../tasks/task-access.service';
import { CreateReminderDto, ReminderQueryDto, UpdateReminderDto } from './dto/reminder.dto';
import { MAX_REMINDER_SCAN } from './notification-fields';
import { nextOccurrence } from './reminder-recurrence';
import { NotificationsService } from './notifications.service';
import { Reminder, ReminderDocument } from './schemas/reminder.schema';

@Injectable()
export class RemindersService {
  constructor(
    @InjectModel(Reminder.name) private readonly model: Model<Reminder>,
    private readonly taskAccess: TaskAccessService,
    private readonly notifications: NotificationsService,
  ) {}

  reminderNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'REMINDER_NOT_FOUND',
      message: 'Lembrete não encontrado.',
    });
  }

  async create(ctx: PermissionContext, dto: CreateReminderDto): Promise<ReminderDocument> {
    return this.model.create({
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      text: dto.text,
      remindAt: new Date(dto.remindAt),
      recurrence: dto.recurrence ?? 'none',
      taskId: await this.requireTask(ctx, dto.taskId),
      doneAt: null,
    });
  }

  /** Only the reminders of the requester, newest first. */
  async list(
    ctx: PermissionContext,
    query: ReminderQueryDto,
  ): Promise<CursorPage<ReminderDocument>> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const after = query.cursor ? decodeObjectIdCursor(query.cursor) : null;
    const filter = {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      doneAt: (query.status ?? 'pending') === 'done' ? { $ne: null } : null,
    };
    const docs = await this.model
      .find(after ? { ...filter, _id: { $lt: after } } : filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .exec();

    return buildCursorPage(docs, limit, (doc) => ({ id: String(doc._id) }));
  }

  async get(ctx: PermissionContext, reminderId: Types.ObjectId): Promise<ReminderDocument> {
    const reminder = await this.model
      .findOne({ _id: reminderId, workspaceId: ctx.workspaceId, userId: ctx.userId })
      .exec();

    if (!reminder) {
      throw this.reminderNotFound();
    }

    return reminder;
  }

  async update(
    ctx: PermissionContext,
    reminderId: Types.ObjectId,
    dto: UpdateReminderDto,
  ): Promise<ReminderDocument> {
    const reminder = await this.get(ctx, reminderId);

    if (dto.text !== undefined) {
      reminder.text = dto.text;
    }

    if (dto.remindAt !== undefined) {
      reminder.remindAt = new Date(dto.remindAt);
    }

    if (dto.recurrence !== undefined) {
      reminder.recurrence = dto.recurrence;
    }

    if (dto.taskId !== undefined) {
      reminder.taskId = await this.requireTask(ctx, dto.taskId);
    }

    if (dto.done !== undefined) {
      reminder.doneAt = dto.done ? new Date() : null;
    }

    return reminder.save();
  }

  async remove(ctx: PermissionContext, reminderId: Types.ObjectId): Promise<void> {
    const reminder = await this.get(ctx, reminderId);

    await reminder.deleteOne();
  }

  /**
   * Delivers every reminder already due as a notification. A recurring one is
   * rescheduled; the others are closed with `doneAt`.
   */
  async deliverDue(now = new Date()): Promise<number> {
    const due = await this.model
      .find({ doneAt: null, remindAt: { $lte: now } })
      .sort({ remindAt: 1 })
      .limit(MAX_REMINDER_SCAN)
      .exec();

    for (const reminder of due) {
      await this.notifications.deliver({
        workspaceId: reminder.workspaceId,
        type: 'reminder',
        entityType: 'reminder',
        entityId: reminder._id,
        actorId: null,
        recipients: [{ userId: reminder.userId, bucket: 'primary' }],
        data: {
          reminderId: String(reminder._id),
          text: reminder.text,
          remindAt: reminder.remindAt.toISOString(),
          taskId: reminder.taskId ? String(reminder.taskId) : null,
        },
        mail: { subject: 'Lembrete', text: reminder.text },
      });

      const next = nextOccurrence(reminder.remindAt, reminder.recurrence, now);

      if (next) {
        reminder.remindAt = next;
      } else {
        reminder.doneAt = now;
      }

      await reminder.save();
    }

    return due.length;
  }

  private async requireTask(
    ctx: PermissionContext,
    taskId: string | null | undefined,
  ): Promise<Types.ObjectId | null> {
    if (!taskId) {
      return null;
    }

    const { task } = await this.taskAccess.requireTask(ctx, taskId, 'view');

    return task._id;
  }
}
