import { Types } from 'mongoose';
import { StatusGroup } from '../hierarchy/status-templates';
import { TaskChanges } from '../tasks/task-events';
import { TriggerType } from './automation-fields';
import { AutomationTrigger } from './schemas/automation.schema';

/** Everything the engine needs about one occurrence of a trigger. */
export interface AutomationEvent {
  workspaceId: Types.ObjectId;
  /** Identifies this occurrence; the due-date cron builds it deterministically. */
  eventId: string;
  triggerType: TriggerType;
  taskId: Types.ObjectId | null;
  listId: Types.ObjectId | null;
  actorId: Types.ObjectId | null;
  changes?: TaskChanges;
  /** Body of a webhook or of a form submission. */
  payload?: Record<string, unknown>;
}

/** The fields of the task the trigger matcher compares against. */
export interface TriggerTaskState {
  statusId: Types.ObjectId;
  statusGroup: StatusGroup;
}

/**
 * Whether the trigger of the automation fits the event. The params narrow the
 * statusChanged trigger; the other types are decided by the event alone (the cron
 * already applied the window of the due-date triggers).
 */
export function matchesTrigger(
  trigger: AutomationTrigger,
  event: AutomationEvent,
  task: TriggerTaskState | null,
): boolean {
  if (trigger.type !== event.triggerType) {
    return false;
  }

  if (trigger.type !== 'statusChanged') {
    return true;
  }

  const params = trigger.params ?? {};
  const toStatusId = asString(params.toStatusId);
  const toStatusGroup = asString(params.toStatusGroup);
  const fromStatusId = asString(params.fromStatusId);

  if (toStatusId && (!task || String(task.statusId) !== toStatusId)) {
    return false;
  }

  if (toStatusGroup && (!task || task.statusGroup !== toStatusGroup)) {
    return false;
  }

  if (fromStatusId && String(event.changes?.statusId?.from ?? '') !== fromStatusId) {
    return false;
  }

  return true;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
