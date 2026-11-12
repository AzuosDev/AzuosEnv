/** Where an automation lives; it fires for every task under the location. */
export const AUTOMATION_LOCATION_TYPES = ['space', 'folder', 'list'] as const;
export type AutomationLocationType = (typeof AUTOMATION_LOCATION_TYPES)[number];

export const TRIGGER_TYPES = [
  'taskCreated',
  'statusChanged',
  'assigneeChanged',
  'priorityChanged',
  'dueDateArrived',
  'dueDatePassed',
  'allSubtasksDone',
  'formSubmitted',
  'webhookReceived',
  'schedule',
] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

export const ACTION_TYPES = [
  'setStatus',
  'assign',
  'unassign',
  'setPriority',
  'addComment',
  'moveToList',
  'addTag',
  'setCustomField',
  'createTask',
  'applyTemplate',
  'notify',
  'callWebhook',
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const AUTOMATION_RUN_STATUSES = ['success', 'failed', 'skipped'] as const;
export type AutomationRunStatus = (typeof AUTOMATION_RUN_STATUSES)[number];

export const TEMPLATE_TYPES = ['space', 'folder', 'list', 'task', 'checklist', 'view'] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];

/** Triggers fed by the public hook route, which is why they own a secret. */
export const HOOK_TRIGGERS: readonly TriggerType[] = ['webhookReceived', 'formSubmitted'];

/** Triggers the due-date cron looks for. */
export const DUE_TRIGGERS: readonly TriggerType[] = ['dueDateArrived', 'dueDatePassed'];

/** Actions nested by automations stop at this depth, which cuts loops. */
export const MAX_AUTOMATION_DEPTH = 3;

export const MAX_AUTOMATION_CONDITIONS = 20;
export const MAX_AUTOMATION_ACTIONS = 10;
export const MAX_ACTION_IDS = 50;

/** Runs are kept for 90 days by a TTL index. */
export const AUTOMATION_RUN_TTL_SECONDS = 90 * 24 * 60 * 60;

/** How long the per-location cache of active automations is trusted. */
export const AUTOMATION_CACHE_TTL_MS = 30_000;

/** Ceiling of tasks the due-date cron reads per automation. */
export const MAX_DUE_TRIGGER_SCAN = 500;

/** Ceiling of tasks a template snapshot carries. */
export const MAX_TEMPLATE_TASKS = 500;

export const WEBHOOK_TIMEOUT_MS = 5_000;

/** Bytes of the hook secret, before base64url. */
export const HOOK_SECRET_BYTES = 32;
