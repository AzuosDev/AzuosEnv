import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HierarchyAccessService } from '../hierarchy/hierarchy-access.service';
import { PermissionContext } from '../hierarchy/permission.service';
import { MAX_RECURRENCE_SCAN } from './recurrence';
import { Task, TaskDocument } from './schemas/task.schema';
import { TasksService } from './tasks.service';

/**
 * Tasks that recur `onSchedule` roll over on their own: once the due date passes,
 * the series moves to the next occurrence whether or not the task was completed.
 */
@Injectable()
export class RecurrenceScheduler {
  private readonly logger = new Logger(RecurrenceScheduler.name);

  constructor(
    @InjectModel(Task.name) private readonly tasks: Model<Task>,
    private readonly access: HierarchyAccessService,
    private readonly tasksService: TasksService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    try {
      await this.rollOverDue();
    } catch (error) {
      this.logger.error(
        'Falha no ciclo de tarefas recorrentes',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Public so the e2e suite can run one cycle without waiting for the cron. */
  async rollOverDue(now = new Date()): Promise<number> {
    const due = await this.tasks
      .find({
        'recurrence.mode': 'onSchedule',
        dueAt: { $ne: null, $lte: now },
        deletedAt: null,
        archivedAt: null,
      })
      .limit(MAX_RECURRENCE_SCAN)
      .exec();
    let rolled = 0;

    for (const task of due) {
      if (await this.rollOver(task, now)) {
        rolled += 1;
      }
    }

    return rolled;
  }

  private async rollOver(task: TaskDocument, now: Date): Promise<boolean> {
    const recurrence = task.recurrence;
    const next = recurrence ? this.tasksService.nextDates(task, recurrence, now) : null;

    if (!recurrence || !next) {
      task.recurrence = null;
      await task.save();

      return false;
    }

    const ctx: PermissionContext = {
      workspaceId: task.workspaceId,
      userId: task.createdBy,
      role: 'owner',
    };

    if (recurrence.createNew) {
      // The rule moves to the new occurrence so this task is not picked up again.
      const list = await this.access.requireList(ctx, task.listId, 'view');

      await this.tasksService.spawnOccurrence(ctx, task, list, recurrence, next);
      task.recurrence = null;
    } else {
      task.startAt = next.startAt;
      task.dueAt = next.dueAt;
    }

    await task.save();

    return true;
  }
}
