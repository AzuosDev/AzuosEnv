import { HttpException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PermissionContext } from '../hierarchy/permission.service';
import { List, ListDocument } from '../hierarchy/schemas/list.schema';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';
import { Workspace } from '../workspaces/schemas/workspace.schema';
import { ActionScope, AutomationActionsService } from './automation-actions.service';
import { AutomationFacts, matchesAll } from './automation-conditions';
import { AutomationRunContext, childContext, runInAutomationContext } from './automation-context';
import { MAX_AUTOMATION_DEPTH } from './automation-fields';
import { AutomationRunsService } from './automation-runs.service';
import { AutomationEvent, matchesTrigger } from './automation-triggers';
import { AutomationsService } from './automations.service';
import { AutomationDocument } from './schemas/automation.schema';

/**
 * The motor: takes one occurrence of a trigger, picks the active automations of the
 * location, checks their conditions and runs their actions as the automation.
 *
 * Loops are cut twice: an automation never reacts to an event its own chain
 * produced, and a chain stops once it is `MAX_AUTOMATION_DEPTH` automations deep.
 */
@Injectable()
export class AutomationEngineService {
  private readonly logger = new Logger(AutomationEngineService.name);

  constructor(
    @InjectModel(Task.name) private readonly tasks: Model<Task>,
    @InjectModel(List.name) private readonly lists: Model<List>,
    @InjectModel(Workspace.name) private readonly workspaces: Model<Workspace>,
    private readonly automations: AutomationsService,
    private readonly runs: AutomationRunsService,
    private readonly actions: AutomationActionsService,
  ) {}

  /** Every automation of the location of the event that the trigger fits. */
  async dispatch(event: AutomationEvent, parent: AutomationRunContext | null): Promise<void> {
    if ((parent?.depth ?? 0) >= MAX_AUTOMATION_DEPTH || !event.listId) {
      return;
    }

    const list = await this.lists
      .findOne({ _id: event.listId, workspaceId: event.workspaceId })
      .exec();

    if (!list) {
      return;
    }

    const candidates = await this.automations.forList(list);

    if (candidates.length === 0) {
      return;
    }

    const task = await this.loadTask(event);

    for (const automation of candidates) {
      if (!matchesTrigger(automation.trigger, event, task)) {
        continue;
      }

      await this.run(automation, event, parent, task, list);
    }
  }

  /** Entry point of the hook route and of the schedule cron, which know the automation. */
  async dispatchTo(automation: AutomationDocument, event: AutomationEvent): Promise<void> {
    const task = await this.loadTask(event);
    const listId = event.listId ?? task?.listId ?? null;
    const list = listId
      ? await this.lists.findOne({ _id: listId, workspaceId: event.workspaceId }).exec()
      : null;

    await this.run(automation, event, null, task, list);
  }

  private async run(
    automation: AutomationDocument,
    event: AutomationEvent,
    parent: AutomationRunContext | null,
    task: TaskDocument | null,
    list: ListDocument | null,
  ): Promise<void> {
    const automationId = String(automation._id);

    // An automation never answers an event that its own chain produced.
    if (parent?.automationIds.includes(automationId)) {
      return;
    }

    const started = Date.now();
    const facts = buildFacts(event, task);

    if (!matchesAll(facts, automation.conditions)) {
      await this.record(automation, event, 'skipped', { task, durationMs: Date.now() - started });

      return;
    }

    const actor: PermissionContext = {
      workspaceId: automation.workspaceId,
      userId: automation.createdBy,
      role: 'owner',
    };
    const scope: ActionScope = {
      automation,
      event,
      actor,
      taskId: task?._id ?? null,
      list,
      facts,
      taskPrefix: await this.taskPrefixOf(automation.workspaceId),
      now: new Date(),
    };
    let executed = 0;

    try {
      await runInAutomationContext(childContext(parent, automationId), async () => {
        for (const action of automation.actions) {
          await this.actions.execute(action, scope);
          executed += 1;
        }
      });

      await this.record(automation, event, 'success', {
        task,
        actionsExecuted: executed,
        durationMs: Date.now() - started,
      });
    } catch (error) {
      this.logger.warn(`Automação ${automationId} falhou: ${messageOf(error)}`);

      await this.record(automation, event, 'failed', {
        task,
        actionsExecuted: executed,
        durationMs: Date.now() - started,
        error: messageOf(error),
      });
    }
  }

  private async record(
    automation: AutomationDocument,
    event: AutomationEvent,
    status: 'success' | 'failed' | 'skipped',
    extra: {
      task: TaskDocument | null;
      actionsExecuted?: number;
      durationMs?: number;
      error?: string;
    },
  ): Promise<void> {
    try {
      await this.runs.record({
        workspaceId: automation.workspaceId,
        automationId: automation._id,
        eventId: event.eventId,
        status,
        error: extra.error ?? null,
        actionsExecuted: extra.actionsExecuted ?? 0,
        durationMs: extra.durationMs ?? 0,
        taskId: extra.task?._id ?? null,
      });
    } catch (error) {
      this.logger.error(
        'Falha ao gravar a execução da automação.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private loadTask(event: AutomationEvent): Promise<TaskDocument | null> {
    if (!event.taskId) {
      return Promise.resolve(null);
    }

    return this.tasks
      .findOne({ _id: event.taskId, workspaceId: event.workspaceId, deletedAt: null })
      .exec();
  }

  private async taskPrefixOf(workspaceId: Types.ObjectId): Promise<string> {
    const workspace = await this.workspaces.findById(workspaceId).select('taskPrefix').exec();

    return workspace?.taskPrefix ?? 'TSK';
  }
}

/** Facts of the event: the task fields flat and under `task`, plus the hook payload. */
export function buildFacts(event: AutomationEvent, task: TaskDocument | null): AutomationFacts {
  const fields = taskFacts(task);

  return {
    ...fields,
    task: fields,
    payload: event.payload ?? {},
    trigger: event.triggerType,
  };
}

function taskFacts(task: TaskDocument | null): AutomationFacts {
  if (!task) {
    return {};
  }

  const facts: AutomationFacts = {
    id: String(task._id),
    customId: task.customId,
    name: task.name,
    descriptionText: task.descriptionText,
    statusId: String(task.statusId),
    statusGroup: task.statusGroup,
    priority: task.priority,
    assigneeIds: task.assigneeIds.map(String),
    watcherIds: task.watcherIds.map(String),
    tagIds: task.tagIds.map(String),
    listId: String(task.listId),
    parentTaskId: task.parentTaskId ? String(task.parentTaskId) : null,
    type: task.type,
    points: task.points,
    estimateMinutes: task.estimateMinutes,
    trackedMinutes: task.trackedMinutes,
    startAt: task.startAt,
    dueAt: task.dueAt,
    closedAt: task.closedAt,
  };

  for (const value of task.customFields) {
    facts[`field:${String(value.fieldId)}`] = value.value;
  }

  return facts;
}

function messageOf(error: unknown): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();

    if (typeof response === 'object' && response !== null && 'message' in response) {
      return String((response as { message: unknown }).message);
    }
  }

  return error instanceof Error ? error.message : String(error);
}
