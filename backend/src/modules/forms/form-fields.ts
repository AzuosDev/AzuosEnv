import { Types } from 'mongoose';

/** Kinds of question a public form can ask. */
export const FORM_FIELD_TYPES = [
  'text',
  'longText',
  'number',
  'email',
  'phone',
  'url',
  'date',
  'dropdown',
  'labels',
  'checkbox',
] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

/** Fields of the task a question can fill. */
export const FORM_MAP_TARGETS = ['name', 'description', 'priority', 'dueAt', 'assignee'] as const;
export type FormMapTarget = (typeof FORM_MAP_TARGETS)[number];

/** A question can also fill a custom field, as `customField:<id>`. */
export const CUSTOM_FIELD_MAP_PREFIX = 'customField:';

/** Accepts a field of the task or a custom field of the List. */
export const MAP_TO_PATTERN = new RegExp(
  `^(${FORM_MAP_TARGETS.join('|')}|${CUSTOM_FIELD_MAP_PREFIX}[0-9a-fA-F]{24})$`,
);

export const FORM_CONDITION_OPS = [
  'eq',
  'ne',
  'contains',
  'gt',
  'lt',
  'isEmpty',
  'isNotEmpty',
] as const;
export type FormConditionOp = (typeof FORM_CONDITION_OPS)[number];

/** Hidden input a human never fills; anything in it is a bot. */
export const HONEYPOT_FIELD = 'website';

export const MAX_FORM_TITLE_LENGTH = 200;
export const MAX_FORM_FIELDS = 50;
export const MAX_FORM_CONDITIONS = 50;
export const MAX_FORM_OPTIONS = 100;
export const MAX_FORM_NOTIFY = 50;

/** Characters accepted in one answer and in the whole submission. */
export const MAX_ANSWER_LENGTH = 5000;
export const MAX_SUBMISSION_LENGTH = 20_000;

/** Bytes of the opaque token of the public link. */
export const FORM_TOKEN_BYTES = 32;

/** Submissions accepted from the same IP per minute. */
export const SUBMIT_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

export function isCustomFieldTarget(mapTo: string): boolean {
  return mapTo.startsWith(CUSTOM_FIELD_MAP_PREFIX);
}

/** Id of the custom field of a `customField:<id>` mapping, or null. */
export function customFieldIdOf(mapTo: string): Types.ObjectId | null {
  if (!isCustomFieldTarget(mapTo)) {
    return null;
  }

  const id = mapTo.slice(CUSTOM_FIELD_MAP_PREFIX.length);

  return Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null;
}
