import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { StatusGroup } from '../hierarchy/status-templates';
import { Task } from '../tasks/schemas/task.schema';
import { isClosedGroup } from '../tasks/task-diff';
import {
  TASK_CREATED,
  TASK_UPDATED,
  TaskCreatedEvent,
  TaskUpdatedEvent,
} from '../tasks/task-events';
import { AutomationRunContext, currentAutomationRun } from './automation-context';
import { AutomationEngineService } from './automation-engine.service';
import { TriggerType } from './automation-fields';
import { AutomationEvent } from './automation-triggers';

/**
 * Turns the domain events of a task into trigger occurrences. The chain of the
 * current run is read before the first `await` so it travels into the dispatch:
 * that is how the engine knows an event came from an automation.
 */
const CLOSED_GROUPS: StatusGroup[] = ['done', 'closed'];

@Injectable()
export class AutomationsListener {
  private readonly logger = new Logger(AutomationsListener.name);

  constructor(
    @InjectModel(Task.name) private readonly tasks: Model<Task>,
    private readonly engine: AutomationEngineService,
  ) {}

  @OnEvent(TASK_CREATED)
  onTaskCreated(event: TaskCreatedEvent): Promise<void> {
    const parent = currentAutomationRun();

    return this.safely(() => this.engine.dispatch(this.eventOf('taskCreated', event), parent));
  }

  @OnEvent(TASK_UPDATED)
  onTaskUpdated(event: TaskUpdatedEvent): Promise<void> {
    const parent = currentAutomationRun();

    return this.safely(() => this.handleUpdated(event, parent));
  }

  private async handleUpdated(
    event: TaskUpdatedEvent,
    parent: AutomationRunContext | null,
  ): Promise<void> {
    const statusChanged = event.changes.statusId !== undefined;

    if (statusChanged) {
      await this.engine.dispatch(this.eventOf('statusChanged', event), parent);
    }

    if (event.changes.assigneeIds !== undefined) {
      await this.engine.dispatch(this.eventOf('assigneeChanged', event), parent);
    }

    if (event.changes.priority !== undefined) {
      await this.engine.dispatch(this.eventOf('priorityChanged', event), parent);
    }

    if (statusChanged) {
      await this.dispatchAllSubtasksDone(event, parent);
    }
  }

  /** Fires for the parent task once its last open subtask is closed. */
  private async dispatchAllSubtasksDone(
    event: TaskUpdatedEvent,
    parent: AutomationRunContext | null,
  ): Promise<void> {
    const task = await this.tasks
      .findOne({ _id: event.taskId, workspaceId: event.workspaceId })
      .select('parentTaskId statusGroup')
      .exec();

    if (!task?.parentTaskId || !isClosedGroup(task.statusGroup)) {
      return;
    }

    const open = await this.tasks.countDocuments({
      workspaceId: event.workspaceId,
      parentTaskId: task.parentTaskId,
      deletedAt: null,
      statusGroup: { $nin: CLOSED_GROUPS },
    });

    if (open > 0) {
      return;
    }

    const parentTask = await this.tasks
      .findOne({
        _id: task.parentTaskId,
        workspaceId: event.workspaceId,
        deletedAt: null,
      })
      .select('listId customId')
      .exec();

    if (!parentTask) {
      return;
    }

    await this.engine.dispatch(
      {
        workspaceId: event.workspaceId,
        eventId: `allSubtasksDone:${randomUUID()}`,
        triggerType: 'allSubtasksDone',
        taskId: parentTask._id,
        listId: parentTask.listId,
        actorId: event.actorId,
      },
      parent,
    );
  }

  private eventOf(
    triggerType: TriggerType,
    event: TaskCreatedEvent | TaskUpdatedEvent,
  ): AutomationEvent {
    return {
      workspaceId: event.workspaceId,
      eventId: `${triggerType}:${randomUUID()}`,
      triggerType,
      taskId: event.taskId,
      listId: event.listId,
      actorId: event.actorId,
      changes: 'changes' in event ? event.changes : undefined,
    };
  }

  /** A failing automation never breaks the request that produced the event. */
  private async safely(run: () => Promise<void>): Promise<void> {
    try {
      await run();
    } catch (error) {
      this.logger.error(
        'Falha ao processar as automações do evento.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
