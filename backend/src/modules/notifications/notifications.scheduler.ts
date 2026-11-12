import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';
import { DUE_SOON_WINDOW_MS, MAX_DUE_SCAN, NotificationType } from './notification-fields';
import { NotificationRecipient, NotificationsService } from './notifications.service';
import { RemindersService } from './reminders.service';

/** Every five minutes: due dates of open tasks and the reminders already due. */
@Injectable()
export class NotificationsScheduler {
  private readonly logger = new Logger(NotificationsScheduler.name);

  constructor(
    @InjectModel(Task.name) private readonly tasks: Model<Task>,
    private readonly notifications: NotificationsService,
    private readonly reminders: RemindersService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async run(): Promise<void> {
    try {
      await this.runDueDates();
      await this.reminders.deliverDue();
    } catch (error) {
      this.logger.error(
        'Falha no ciclo de notificações agendadas',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Public so the e2e suite can run one cycle without waiting for the cron. */
  async runDueDates(now = new Date()): Promise<void> {
    await this.notifyDue('dueSoon', {
      $gt: now,
      $lte: new Date(now.getTime() + DUE_SOON_WINDOW_MS),
    });
    await this.notifyDue('overdue', { $lte: now });
  }

  private async notifyDue(type: NotificationType, dueAt: Record<string, Date>): Promise<void> {
    const tasks = await this.tasks
      .find({
        dueAt,
        deletedAt: null,
        archivedAt: null,
        statusGroup: { $nin: ['done', 'closed'] },
      })
      .limit(MAX_DUE_SCAN)
      .exec();

    for (const task of tasks) {
      const recipients = this.recipientsOf(task);

      if (recipients.length === 0) {
        continue;
      }

      const iso = task.dueAt?.toISOString() ?? null;

      await this.notifications.deliver({
        workspaceId: task.workspaceId,
        type,
        entityType: 'task',
        entityId: task._id,
        actorId: null,
        recipients,
        data: {
          taskId: String(task._id),
          customId: task.customId,
          name: task.name,
          listId: String(task.listId),
          dueAt: iso,
        },
        // The same due date is announced once per task and user.
        dedupe: { 'data.dueAt': iso },
        mail: {
          subject: `${type === 'overdue' ? 'Tarefa atrasada' : 'Tarefa vence em breve'}: ${task.customId}`,
          text: `${task.customId} — ${task.name}`,
        },
      });
    }
  }

  private recipientsOf(task: TaskDocument): NotificationRecipient[] {
    return [
      ...task.assigneeIds.map((userId) => ({ userId, bucket: 'primary' as const })),
      ...task.watcherIds.map((userId) => ({ userId, bucket: 'other' as const })),
    ];
  }
}
