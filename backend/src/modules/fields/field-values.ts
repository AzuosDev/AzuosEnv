import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  CustomFieldType,
  DEFAULT_PRECISION,
  FieldFilterOp,
  PROGRESS_MAX,
  RATING_MAX,
  isNumericType,
} from './custom-field-types';
import { evaluateFormula } from './formula';
import { CustomField, CustomFieldDocument } from './schemas/custom-field.schema';

/** Value of one field stored in the task. */
export interface FieldValueEntry {
  fieldId: unknown;
  value: unknown;
}

/** Fields of the workspace, by id and by lowercase name (used by the formulas). */
export interface CustomFieldIndex {
  byId: Map<string, CustomFieldDocument>;
  byName: Map<string, CustomFieldDocument>;
}

export interface FieldFilter {
  fieldId: string;
  op: FieldFilterOp;
  value?: unknown;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL = /^https?:\/\/\S+$/i;
const PHONE = /^[\d\s()+-]{6,20}$/;
const MAX_TEXT = 500;
const MAX_LONG_TEXT = 20000;

export function invalidValue(field: Pick<CustomField, 'name'>): BadRequestException {
  return new BadRequestException({
    code: 'INVALID_CUSTOM_FIELD_VALUE',
    message: `Valor inválido para o campo ${field.name}.`,
  });
}

export function isEmptyFieldValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') {
    return true;
  }

  return Array.isArray(value) && value.length === 0;
}

/** Validates and normalizes the value by type; a formula is never written. */
export function normalizeFieldValue(field: CustomField, value: unknown): unknown {
  if (field.type === 'formula') {
    throw new BadRequestException({
      code: 'INVALID_CUSTOM_FIELD_VALUE',
      message: `O campo ${field.name} é calculado e não aceita valor.`,
    });
  }

  if (isEmptyFieldValue(value)) {
    return null;
  }

  return normalizeByType(field, field.type, value);
}

function normalizeByType(field: CustomField, type: CustomFieldType, value: unknown): unknown {
  if (type === 'checkbox') {
    if (typeof value !== 'boolean') {
      throw invalidValue(field);
    }

    return value;
  }

  if (type === 'number' || type === 'currency') {
    return round(asNumber(field, value), field.config?.precision ?? DEFAULT_PRECISION);
  }

  if (type === 'rating') {
    return asInteger(field, value, 0, RATING_MAX);
  }

  if (type === 'progress') {
    return asInteger(field, value, 0, PROGRESS_MAX);
  }

  if (type === 'date') {
    const date = new Date(asText(field, value));

    if (Number.isNaN(date.getTime())) {
      throw invalidValue(field);
    }

    return date;
  }

  if (type === 'dropdown') {
    return asOptionId(field, value);
  }

  if (type === 'labels') {
    return asArray(field, value).map((item) => asOptionId(field, item));
  }

  if (type === 'people' || type === 'files' || type === 'relationship') {
    return uniqueIds(asArray(field, value).map((item) => asObjectId(field, item)));
  }

  if (type === 'location') {
    return asLocation(field, value);
  }

  const text = asText(field, value).trim();

  if (type === 'email' && !EMAIL.test(text)) {
    throw invalidValue(field);
  }

  if (type === 'url' && !URL.test(text)) {
    throw invalidValue(field);
  }

  if (type === 'phone' && !PHONE.test(text)) {
    throw invalidValue(field);
  }

  if (text.length > (type === 'longText' ? MAX_LONG_TEXT : MAX_TEXT)) {
    throw invalidValue(field);
  }

  return text;
}

/** Stored values plus the formulas computed from them. */
export function fieldValueMap(
  entries: FieldValueEntry[] | undefined,
  index: CustomFieldIndex,
): Map<string, unknown> {
  const values = new Map<string, unknown>(
    (entries ?? []).map((entry) => [String(entry.fieldId), entry.value]),
  );

  for (const [id, field] of index.byId) {
    if (field.type === 'formula') {
      values.set(id, computeFormula(field, values, index));
    }
  }

  return values;
}

/** The values of the task as the API returns them, with the formulas included. */
export function fieldValueList(
  entries: FieldValueEntry[] | undefined,
  index: CustomFieldIndex,
): { fieldId: string; value: unknown }[] {
  return [...fieldValueMap(entries, index)].map(([fieldId, value]) => ({ fieldId, value }));
}

export function computeFormula(
  field: CustomFieldDocument,
  values: Map<string, unknown>,
  index: CustomFieldIndex,
): number | null {
  const expression = field.config?.expression;

  if (!expression) {
    return null;
  }

  return evaluateFormula(expression, (ref) => {
    const target = index.byId.get(ref) ?? index.byName.get(ref.toLowerCase());

    if (!target || !isNumericType(target.type)) {
      return null;
    }

    const value = values.get(String(target._id));

    return typeof value === 'number' ? value : null;
  });
}

export function matchesFieldFilters(values: Map<string, unknown>, filters: FieldFilter[]): boolean {
  return filters.every((filter) => matchesFieldFilter(values.get(filter.fieldId), filter));
}

export function matchesFieldFilter(value: unknown, filter: FieldFilter): boolean {
  if (filter.op === 'isEmpty') {
    return isEmptyFieldValue(value) === (filter.value !== false);
  }

  if (isEmptyFieldValue(value)) {
    return false;
  }

  if (filter.op === 'eq') {
    return Array.isArray(value)
      ? value.some((item) => sameValue(item, filter.value))
      : sameValue(value, filter.value);
  }

  if (filter.op === 'contains') {
    const needle = lower(filter.value);

    return Array.isArray(value)
      ? value.some((item) => lower(item).includes(needle))
      : lower(value).includes(needle);
  }

  const left = comparable(value);
  const right = comparable(filter.value);

  if (left === null || right === null) {
    return false;
  }

  return filter.op === 'gt' ? left > right : left < right;
}

/** Sortable string of a field value; empty values go last. */
export function fieldSortKey(value: unknown): string {
  if (isEmptyFieldValue(value)) {
    return '9';
  }

  if (typeof value === 'number') {
    return `1${(value + 1e12).toFixed(4).padStart(20, '0')}`;
  }

  if (value instanceof Date) {
    return `1${value.toISOString()}`;
  }

  if (typeof value === 'boolean') {
    return value ? '10' : '11';
  }

  return `1${lower(Array.isArray(value) ? value.join(',') : value)}`;
}

function sameValue(value: unknown, other: unknown): boolean {
  if (typeof value === 'number' || typeof other === 'number') {
    return Number(value) === Number(other);
  }

  if (typeof value === 'boolean') {
    return value === (other === true || other === 'true');
  }

  if (value instanceof Date) {
    return value.getTime() === new Date(String(other)).getTime();
  }

  return String(value) === String(other);
}

/** Number used by gt and lt: dates compare as time, everything else as number. */
function comparable(value: unknown): number | null {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && /[-:T]/.test(value)) {
    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function lower(value: unknown): string {
  return String(value ?? '').toLocaleLowerCase('pt-BR');
}

function asNumber(field: CustomField, value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value);

  if (typeof value === 'boolean' || !Number.isFinite(number)) {
    throw invalidValue(field);
  }

  return number;
}

function asInteger(field: CustomField, value: unknown, min: number, max: number): number {
  const number = asNumber(field, value);

  if (!Number.isInteger(number) || number < min || number > max) {
    throw invalidValue(field);
  }

  return number;
}

function asText(field: CustomField, value: unknown): string {
  if (typeof value !== 'string') {
    throw invalidValue(field);
  }

  return value;
}

function asArray(field: CustomField, value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw invalidValue(field);
  }

  return value;
}

function asOptionId(field: CustomField, value: unknown): string {
  const id = asText(field, value);

  if (!(field.config?.options ?? []).some((option) => option.id === id)) {
    throw invalidValue(field);
  }

  return id;
}

function asObjectId(field: CustomField, value: unknown): Types.ObjectId {
  if (typeof value !== 'string' || !Types.ObjectId.isValid(value)) {
    throw invalidValue(field);
  }

  return new Types.ObjectId(value);
}

function asLocation(field: CustomField, value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalidValue(field);
  }

  const location = value as Record<string, unknown>;
  const lat = Number(location.lat);
  const lng = Number(location.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw invalidValue(field);
  }

  const address = location.address === undefined ? undefined : asText(field, location.address);

  return address === undefined ? { lat, lng } : { lat, lng, address };
}

function round(value: number, precision: number): number {
  const factor = 10 ** precision;

  return Math.round(value * factor) / factor;
}

function uniqueIds(ids: Types.ObjectId[]): Types.ObjectId[] {
  const seen = new Set<string>();

  return ids.filter((id) => {
    const key = String(id);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}
