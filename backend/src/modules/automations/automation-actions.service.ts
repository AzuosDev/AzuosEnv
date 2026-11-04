import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CommentsService } from '../collaboration/comments.service';
import { HierarchyAccessService } from '../hierarchy/hierarchy-access.service';
import { PermissionContext } from '../hierarchy/permission.service';
import { ListDocument } from '../hierarchy/schemas/list.schema';
import { StatusSetsService } from '../hierarchy/status-sets.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';
import { TasksService } from '../tasks/tasks.service';
import { TaskPriority } from '../tasks/task-fields';
import { MembersService } from '../workspaces/members.service';
import { AutomationFacts } from './automation-conditions';
import { WEBHOOK_TIMEOUT_MS } from './automation-fields';
import { interpolateParams } from './automation-templating';
import { AutomationEvent } from './automation-triggers';
import { AutomationAction, AutomationDocument } from './schemas/automation.schema';
import { TemplatesService } from './templates.service';

/** Everything one action needs to touch the workspace on behalf of the automation. */
export interface ActionScope {
  automation: AutomationDocument;
  event: AutomationEvent;
  /** Actor of every write: the automation, running as whoever created it. */
  actor: PermissionContext;
  taskId: Types.ObjectId | null;
  list: ListDocument | null;
  facts: AutomationFacts;
  taskPrefix: string;
  /** Anchor of the relative dates of createTask and applyTemplate. */
  now: Date;
}

@Injectable()
export class AutomationActionsService {
  constructor(
    @InjectModel(Task.name) private readonly tasks: Model<Task>,
    private readonly tasksService: TasksService,
    private readonly comments: CommentsService,
    private readonly statusSets: StatusSetsService,
    private readonly access: HierarchyAccessService,
    private readonly notifications: NotificationsService,
    private readonly members: MembersService,
    private readonly templates: TemplatesService,
  ) {}

  /** Runs one action; anything it throws fails the whole run of the automation. */
  async execute(action: AutomationAction, scope: ActionScope): Promise<void> {
    const params = interpolateParams(action.params ?? {}, scope.facts);

    switch (action.type) {
      case 'setStatus':
        return this.setStatus(params, scope);
      case 'assign':
        return this.assign(params, scope);
      case 'unassign':
        return this.unassign(params, scope);
      case 'setPriority':
        return this.setPriority(params, scope);
      case 'addComment':
        return this.addComment(params, scope);
      case 'moveToList':
        return this.moveToList(params, scope);
      case 'addTag':
        return this.addTag(params, scope);
      case 'setCustomField':
        return this.setCustomField(params, scope);
      case 'createTask':
        return this.createTask(params, scope);
      case 'applyTemplate':
        return this.applyTemplate(params, scope);
      case 'notify':
        return this.notify(params, scope);
      case 'callWebhook':
        return this.callWebhook(params, scope);
    }
  }

  private async setStatus(params: Record<string, unknown>, scope: ActionScope): Promise<void> {
    const task = await this.requireTask(scope, 'setStatus');
    const statusId = asString(params.statusId) ?? (await this.statusOfGroup(task, params));

    if (!statusId) {
      throw this.invalid('Nenhum status do grupo pedido existe na List da tarefa.');
    }

    await this.tasksService.update(scope.actor, String(task._id), { statusId });
  }

  private async assign(params: Record<string, unknown>, scope: ActionScope): Promise<void> {
    const task = await this.requireTask(scope, 'assign');
    const added = asIds(params.userIds);

    if (added.length === 0) {
      throw this.invalid('A ação assign exige userIds.');
    }

    const assigneeIds = unique([...task.assigneeIds.map(String), ...added]);

    await this.tasksService.update(scope.actor, String(task._id), { assigneeIds });
  }

  private async unassign(params: Record<string, unknown>, scope: ActionScope): Promise<void> {
    const task = await this.requireTask(scope, 'unassign');
    const removed = new Set(asIds(params.userIds));
    const assigneeIds =
      removed.size === 0 ? [] : task.assigneeIds.map(String).filter((id) => !removed.has(id));

    await this.tasksService.update(scope.actor, String(task._id), { assigneeIds });
  }

  private async setPriority(params: Record<string, unknown>, scope: ActionScope): Promise<void> {
    const task = await this.requireTask(scope, 'setPriority');

    await this.tasksService.update(scope.actor, String(task._id), {
      priority: (asString(params.priority) ?? null) as TaskPriority | null,
    });
  }

  private async addComment(params: Record<string, unknown>, scope: ActionScope): Promise<void> {
    const task = await this.requireTask(scope, 'addComment');
    const bodyText = asString(params.bodyText);

    if (!bodyText) {
      throw this.invalid('A ação addComment exige bodyText.');
    }

    await this.comments.create(scope.actor, String(task._id), { bodyText });
  }

  private async moveToList(params: Record<string, unknown>, scope: ActionScope): Promise<void> {
    const task = await this.requireTask(scope, 'moveToList');
    const listId = asString(params.listId);

    if (!listId) {
      throw this.invalid('A ação moveToList exige listId.');
    }

    await this.tasksService.move(scope.actor, String(task._id), { listId });
  }

  private async addTag(params: Record<string, unknown>, scope: ActionScope): Promise<void> {
    const task = await this.requireTask(scope, 'addTag');
    const tagIds = unique([...task.tagIds.map(String), ...asIds(params.tagIds)]);

    await this.tasksService.update(scope.actor, String(task._id), { tagIds });
  }

  private async setCustomField(params: Record<string, unknown>, scope: ActionScope): Promise<void> {
    const task = await this.requireTask(scope, 'setCustomField');
    const fieldId = asString(params.fieldId);

    if (!fieldId) {
      throw this.invalid('A ação setCustomField exige fieldId.');
    }

    await this.tasksService.update(scope.actor, String(task._id), {
      customFields: [{ fieldId, value: params.value ?? null }],
    });
  }

  private async createTask(params: Record<string, unknown>, scope: ActionScope): Promise<void> {
    const listId = asString(params.listId);
    const name = asString(params.name);

    if (!listId) {
      throw this.invalid('A ação createTask exige listId.');
    }

    await this.tasksService.create(scope.actor, new Types.ObjectId(listId), scope.taskPrefix, {
      name: name && name.length > 0 ? name.slice(0, 500) : scope.automation.name,
      priority: (asString(params.priority) ?? null) as TaskPriority | null,
      assigneeIds: asIds(params.assigneeIds),
      startAt: offsetIso(params.startOffsetMinutes, scope.now),
      dueAt: offsetIso(params.dueOffsetMinutes, scope.now),
    });
  }

  private async applyTemplate(params: Record<string, unknown>, scope: ActionScope): Promise<void> {
    const templateId = asString(params.templateId);

    if (!templateId) {
      throw this.invalid('A ação applyTemplate exige templateId.');
    }

    await this.templates.applyForAutomation(scope.actor, new Types.ObjectId(templateId), {
      listId: asString(params.listId) ?? (scope.list ? String(scope.list._id) : null),
      taskId: scope.taskId ? String(scope.taskId) : null,
      taskPrefix: scope.taskPrefix,
      anchor: scope.now,
    });
  }

  private async notify(params: Record<string, unknown>, scope: ActionScope): Promise<void> {
    const task = scope.taskId ? await this.loadTask(scope) : null;
    const wanted = asIds(params.userIds);
    const targets = wanted.length > 0 ? wanted : (task?.assigneeIds ?? []).map(String);
    const userIds = await this.members.activeUserIds(
      scope.actor.workspaceId,
      unique(targets).map((id) => new Types.ObjectId(id)),
    );

    if (userIds.length === 0) {
      return;
    }

    await this.notifications.deliver({
      workspaceId: scope.actor.workspaceId,
      type: 'automation',
      entityType: task ? 'task' : 'workspace',
      entityId: task ? task._id : scope.actor.workspaceId,
      actorId: null,
      recipients: userIds.map((userId) => ({ userId, bucket: 'primary' as const })),
      data: {
        automationId: String(scope.automation._id),
        automationName: scope.automation.name,
        message: asString(params.message) ?? scope.automation.name,
        customId: task?.customId ?? null,
        eventId: scope.event.eventId,
      },
      dedupe: { 'data.eventId': scope.event.eventId },
    });
  }

  private async callWebhook(params: Record<string, unknown>, scope: ActionScope): Promise<void> {
    const url = asString(params.url);

    if (!url) {
      throw this.invalid('A ação callWebhook exige url.');
    }

    const body =
      params.body && typeof params.body === 'object'
        ? params.body
        : {
            automationId: String(scope.automation._id),
            trigger: scope.event.triggerType,
            taskId: scope.taskId ? String(scope.taskId) : null,
            payload: scope.event.payload ?? {},
          };

    const response = await fetch(url, {
      method: asString(params.method) ?? 'POST',
      headers: {
        'content-type': 'application/json',
        ...(params.headers && typeof params.headers === 'object'
          ? (params.headers as Record<string, string>)
          : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw this.invalid(`O webhook respondeu ${response.status}.`);
    }
  }

  /** First status of the group inside the status set of the List of the task. */
  private async statusOfGroup(
    task: TaskDocument,
    params: Record<string, unknown>,
  ): Promise<string | null> {
    const group = asString(params.statusGroup);

    if (!group) {
      return null;
    }

    const actor: PermissionContext = {
      workspaceId: task.workspaceId,
      userId: task.createdBy,
      role: 'owner',
    };
    const list = await this.access.requireList(actor, task.listId, 'view');
    const effective = await this.statusSets.resolveForList(list);
    const status = effective.statuses.find((one) => one.group === group);

    return status ? String(status._id) : null;
  }

  /** Reloaded before every action so a chain of actions never writes stale fields. */
  private async requireTask(scope: ActionScope, action: string): Promise<TaskDocument> {
    const task = scope.taskId ? await this.loadTask(scope) : null;

    if (!task) {
      throw this.invalid(`A ação ${action} precisa de uma tarefa.`);
    }

    return task;
  }

  private loadTask(scope: ActionScope): Promise<TaskDocument | null> {
    return this.tasks
      .findOne({
        _id: scope.taskId,
        workspaceId: scope.actor.workspaceId,
        deletedAt: null,
      })
      .exec();
  }

  private invalid(message: string): BadRequestException {
    return new BadRequestException({ code: 'INVALID_AUTOMATION_ACTION', message });
  }
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asIds(value: unknown): string[] {
  const list = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];

  return list.filter((id): id is string => typeof id === 'string' && Types.ObjectId.isValid(id));
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

function offsetIso(value: unknown, now: Date): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return new Date(now.getTime() + value * 60_000).toISOString();
}
