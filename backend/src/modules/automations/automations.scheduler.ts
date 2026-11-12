import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { Folder } from '../hierarchy/schemas/folder.schema';
import { List } from '../hierarchy/schemas/list.schema';
import { StatusGroup } from '../hierarchy/status-templates';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';
import { AUTOMATIONS_CHANGED } from './automation-events';
import { DUE_TRIGGERS, MAX_DUE_TRIGGER_SCAN } from './automation-fields';
import { AutomationEngineService } from './automation-engine.service';
import { AutomationRunsService } from './automation-runs.service';
import { AutomationEvent } from './automation-triggers';
import { AutomationsService } from './automations.service';
import { AutomationDocument } from './schemas/automation.schema';

const JOB_PREFIX = 'automation:';
const CLOSED_GROUPS: StatusGroup[] = ['done', 'closed'];

/**
 * Two clocks: a fixed cron that looks for the due dates of every workspace, and one
 * dynamic cron job per `schedule` automation, registered in the SchedulerRegistry
 * and rebuilt whenever an automation of the workspace is written.
 */
@Injectable()
export class AutomationsScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutomationsScheduler.name);

  constructor(
    @InjectModel(Task.name) private readonly tasks: Model<Task>,
    @InjectModel(List.name) private readonly lists: Model<List>,
    @InjectModel(Folder.name) private readonly folders: Model<Folder>,
    private readonly automations: AutomationsService,
    private readonly runs: AutomationRunsService,
    private readonly engine: AutomationEngineService,
    private readonly registry: SchedulerRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.syncScheduleJobs();
  }

  onModuleDestroy(): void {
    this.clearScheduleJobs();
  }

  @OnEvent(AUTOMATIONS_CHANGED)
  async onAutomationsChanged(): Promise<void> {
    await this.syncScheduleJobs();
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async run(): Promise<void> {
    try {
      await this.runDueTriggers();
    } catch (error) {
      this.logger.error(
        'Falha no ciclo de automações por data.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Public so the e2e suite can run one cycle. Each (automation, task, due date)
   * fires once: the run is recorded under a deterministic event id and the next
   * cycle skips what already ran.
   */
  async runDueTriggers(now = new Date()): Promise<number> {
    const automations = await this.automations.activeByTriggers(DUE_TRIGGERS);
    let fired = 0;

    for (const automation of automations) {
      for (const task of await this.dueTasks(automation, now)) {
        const eventId = `${automation.trigger.type}:${String(automation._id)}:${String(task._id)}:${task.dueAt?.toISOString() ?? ''}`;

        if (await this.runs.alreadyRan(automation.workspaceId, automation._id, eventId)) {
          continue;
        }

        await this.engine.dispatchTo(automation, {
          workspaceId: automation.workspaceId,
          eventId,
          triggerType: automation.trigger.type,
          taskId: task._id,
          listId: task.listId,
          actorId: null,
        });
        fired += 1;
      }
    }

    return fired;
  }

  /** Public so the e2e suite can fire a scheduled automation without waiting. */
  async runSchedule(automation: AutomationDocument): Promise<void> {
    const event: AutomationEvent = {
      workspaceId: automation.workspaceId,
      eventId: `schedule:${String(automation._id)}:${randomUUID()}`,
      triggerType: 'schedule',
      taskId: null,
      listId: automation.locationType === 'list' ? automation.locationId : null,
      actorId: null,
    };

    await this.engine.dispatchTo(automation, event);
  }

  /** Open tasks of the location whose due date falls in the window of the trigger. */
  private async dueTasks(automation: AutomationDocument, now: Date): Promise<TaskDocument[]> {
    const listIds = await this.listIdsOf(automation);

    if (listIds.length === 0) {
      return [];
    }

    const beforeMinutes = Number(automation.trigger.params?.beforeMinutes ?? 0);
    const dueAt =
      automation.trigger.type === 'dueDatePassed'
        ? { $ne: null, $lt: now }
        : {
            $ne: null,
            $gte: now,
            $lte: new Date(now.getTime() + Math.max(beforeMinutes, 0) * 60_000),
          };

    return this.tasks
      .find({
        workspaceId: automation.workspaceId,
        listIds: { $in: listIds },
        statusGroup: { $nin: CLOSED_GROUPS },
        deletedAt: null,
        archivedAt: null,
        dueAt,
      })
      .sort({ dueAt: 1 })
      .limit(MAX_DUE_TRIGGER_SCAN)
      .exec();
  }

  private async listIdsOf(automation: AutomationDocument): Promise<Types.ObjectId[]> {
    if (automation.locationType === 'list') {
      return [automation.locationId];
    }

    const filter =
      automation.locationType === 'space'
        ? { spaceId: automation.locationId }
        : {
            folderId: {
              $in: [
                automation.locationId,
                ...(
                  await this.folders
                    .find({
                      workspaceId: automation.workspaceId,
                      parentFolderId: automation.locationId,
                    })
                    .select('_id')
                    .exec()
                ).map((folder) => folder._id),
              ],
            },
          };

    const lists = await this.lists
      .find({ workspaceId: automation.workspaceId, deletedAt: null, archivedAt: null, ...filter })
      .select('_id')
      .exec();

    return lists.map((list) => list._id);
  }

  /** Rebuilds the dynamic cron jobs from the active `schedule` automations. */
  private async syncScheduleJobs(): Promise<void> {
    this.clearScheduleJobs();

    for (const automation of await this.automations.activeByTriggers(['schedule'])) {
      const cron = String(automation.trigger.params?.cron ?? '');
      const timezone = automation.trigger.params?.timezone;

      if (!cron) {
        continue;
      }

      try {
        const job = CronJob.from({
          cronTime: cron,
          timeZone: typeof timezone === 'string' ? timezone : undefined,
          start: false,
          onTick: () => {
            void this.runSchedule(automation).catch((error: unknown) =>
              this.logger.error(
                `Falha na automação agendada ${String(automation._id)}.`,
                error instanceof Error ? error.stack : String(error),
              ),
            );
          },
        });

        this.registry.addCronJob(`${JOB_PREFIX}${String(automation._id)}`, job);
        job.start();
      } catch (error) {
        this.logger.warn(
          `Cron inválido na automação ${String(automation._id)}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  private clearScheduleJobs(): void {
    const names = [...this.registry.getCronJobs().keys()].filter((name) =>
      name.startsWith(JOB_PREFIX),
    );

    for (const name of names) {
      this.registry.deleteCronJob(name);
    }
  }
}
