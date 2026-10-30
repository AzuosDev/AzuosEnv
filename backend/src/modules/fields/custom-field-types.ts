export const CUSTOM_FIELD_SCOPES = ['space', 'folder', 'list'] as const;
export type CustomFieldScope = (typeof CUSTOM_FIELD_SCOPES)[number];

export const CUSTOM_FIELD_TYPES = [
  'text',
  'longText',
  'number',
  'currency',
  'date',
  'dropdown',
  'labels',
  'checkbox',
  'people',
  'email',
  'phone',
  'url',
  'rating',
  'progress',
  'formula',
  'files',
  'relationship',
  'location',
] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

/** Types a formula can read, and that sort and compare as numbers. */
export const NUMERIC_FIELD_TYPES = ['number', 'currency', 'rating', 'progress'] as const;

/** Types whose value is a list of option ids defined in `config.options`. */
export const OPTION_FIELD_TYPES = ['dropdown', 'labels'] as const;

export const DEFAULT_CURRENCY = 'BRL';
export const DEFAULT_PRECISION = 2;
export const MAX_PRECISION = 4;
export const RATING_MAX = 5;
export const PROGRESS_MAX = 100;
export const MAX_FORMULA_LENGTH = 500;
export const MAX_FIELD_OPTIONS = 50;

export const FIELD_FILTER_OPS = ['eq', 'contains', 'gt', 'lt', 'isEmpty'] as const;
export type FieldFilterOp = (typeof FIELD_FILTER_OPS)[number];

export function isNumericType(type: CustomFieldType): boolean {
  return (NUMERIC_FIELD_TYPES as readonly string[]).includes(type);
}
