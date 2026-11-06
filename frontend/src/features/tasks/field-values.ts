import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type {
  CustomField,
  CustomFieldOption,
  CustomFieldType,
  FieldFilterOp,
  TaskFieldInput,
  TaskFieldValue,
  UpdateTaskInput,
  ViewColumn,
  ViewConfig,
} from '@/api/types';

export const FIELD_TYPE_LABEL: Record<CustomFieldType, string> = {
  text: 'Texto',
  longText: 'Texto longo',
  number: 'Número',
  currency: 'Moeda',
  date: 'Data',
  dropdown: 'Lista (uma opção)',
  labels: 'Etiquetas (várias)',
  checkbox: 'Caixa de seleção',
  people: 'Pessoas',
  email: 'E-mail',
  phone: 'Telefone',
  url: 'Link',
  rating: 'Avaliação',
  progress: 'Progresso',
  formula: 'Fórmula',
  files: 'Arquivos',
  relationship: 'Relacionamento',
  location: 'Localização',
};

/** Ordem do seletor de tipo ao criar um campo no local. */
export const FIELD_TYPE_ORDER: CustomFieldType[] = [
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
];

/** Tipos cujo valor é uma ou mais opções declaradas em config.options. */
export const OPTION_FIELD_TYPES: CustomFieldType[] = ['dropdown', 'labels'];

/** Tipos que comparam e ordenam como número. */
export const NUMERIC_FIELD_TYPES: CustomFieldType[] = ['number', 'currency', 'rating', 'progress'];

/** Tipos escritos como texto puro. */
export const TEXT_FIELD_TYPES: CustomFieldType[] = ['text', 'longText', 'email', 'phone', 'url'];

export const RATING_MAX = 5;
export const PROGRESS_MAX = 100;
export const DEFAULT_CURRENCY = 'BRL';
export const DEFAULT_PRECISION = 2;

/** Quantas colunas de campo a Lista mostra ao mesmo tempo. */
export const MAX_FIELD_COLUMNS = 3;

/** Exemplo dentro do campo vazio, para ele não parecer texto fixo. */
export const FIELD_PLACEHOLDER: Partial<Record<CustomFieldType, string>> = {
  text: 'Escreva aqui',
  longText: 'Escreva aqui',
  number: '0',
  currency: '0,00',
  email: 'nome@empresa.com',
  phone: '(11) 90000-0000',
  url: 'https://',
};

/** A fórmula é calculada pela API e nunca aceita valor. */
export function isReadOnlyField(type: CustomFieldType): boolean {
  return type === 'formula';
}

export function isEmptyFieldValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') {
    return true;
  }

  return Array.isArray(value) && value.length === 0;
}

/** Valor de um campo na tarefa, já pronto para o controle da tela. */
export function fieldValueOf(values: TaskFieldValue[], fieldId: string): unknown {
  return values.find((entry) => String(entry.fieldId) === fieldId)?.value ?? null;
}

/** Troca o valor de um campo na lista de valores da tarefa. */
export function withFieldValue(
  values: TaskFieldValue[],
  fieldId: string,
  value: unknown,
): TaskFieldValue[] {
  const rest = values.filter((entry) => String(entry.fieldId) !== fieldId);

  return [...rest, { fieldId, value }];
}

/**
 * Valores no corpo do PATCH da tarefa. O contrato descreve valor livre como
 * objeto vazio, então a conversão do JSON acontece só aqui.
 */
export function fieldValuesBody(values: TaskFieldInput[]): UpdateTaskInput['customFields'] {
  return values as UpdateTaskInput['customFields'];
}

export function optionsOf(field: CustomField): CustomFieldOption[] {
  return field.config.options ?? [];
}

export function optionName(field: CustomField, id: unknown): string {
  return optionsOf(field).find((option) => option.id === id)?.name ?? String(id ?? '');
}

export function currencyOf(field: CustomField): string {
  return field.config.currency ?? DEFAULT_CURRENCY;
}

export function precisionOf(field: CustomField): number {
  return field.config.precision ?? DEFAULT_PRECISION;
}

function formatNumber(value: number, precision: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision,
  }).format(value);
}

function formatCurrency(value: number, currency: string, precision: number): string {
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
      maximumFractionDigits: precision,
    }).format(value);
  } catch {
    return formatNumber(value, precision);
  }
}

/** Nome da pessoa quando ela está no workspace; o id cru não vai para a tela. */
export type NameOf = (id: string) => string | undefined;

export interface FormatFieldOptions {
  /** Nome de pessoa, anexo ou tarefa referenciada pelo valor. */
  nameOf?: NameOf;
}

/** Valor do campo em texto pt-BR, para a coluna da Lista e a leitura rápida. */
export function formatFieldValue(
  field: CustomField,
  value: unknown,
  options: FormatFieldOptions = {},
): string {
  if (isEmptyFieldValue(value)) {
    return '';
  }

  if (field.type === 'checkbox') {
    return value === true ? 'Sim' : 'Não';
  }

  if (field.type === 'currency') {
    return typeof value === 'number'
      ? formatCurrency(value, currencyOf(field), precisionOf(field))
      : String(value);
  }

  if (field.type === 'number' || field.type === 'formula') {
    return typeof value === 'number' ? formatNumber(value, precisionOf(field)) : String(value);
  }

  if (field.type === 'rating') {
    return `${String(value)}/${String(RATING_MAX)}`;
  }

  if (field.type === 'progress') {
    return `${String(value)}%`;
  }

  if (field.type === 'date') {
    const date = new Date(String(value));

    return Number.isNaN(date.getTime()) ? '' : format(date, 'd MMM yyyy', { locale: ptBR });
  }

  if (field.type === 'dropdown') {
    return optionName(field, value);
  }

  if (field.type === 'labels') {
    return asArray(value)
      .map((item) => optionName(field, item))
      .join(', ');
  }

  if (field.type === 'people' || field.type === 'files' || field.type === 'relationship') {
    return asArray(value)
      .map((item) => options.nameOf?.(String(item)) ?? String(item))
      .join(', ');
  }

  if (field.type === 'location') {
    return formatLocation(value);
  }

  return String(value);
}

export interface LocationValue {
  lat: number;
  lng: number;
  address?: string;
}

export function asLocation(value: unknown): LocationValue | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    lat,
    lng,
    ...(typeof raw.address === 'string' && raw.address !== '' ? { address: raw.address } : {}),
  };
}

function formatLocation(value: unknown): string {
  const location = asLocation(value);

  if (!location) {
    return '';
  }

  const point = `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;

  return location.address ? `${location.address} (${point})` : point;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asStringArray(value: unknown): string[] {
  return asArray(value).map((item) => String(item));
}

/** Texto do valor dentro de um input; vazio quando o campo não tem valor. */
export function fieldInputText(field: CustomField, value: unknown): string {
  if (isEmptyFieldValue(value)) {
    return '';
  }

  if (field.type === 'date') {
    const date = new Date(String(value));

    return Number.isNaN(date.getTime()) ? '' : format(date, 'yyyy-MM-dd');
  }

  if (NUMERIC_FIELD_TYPES.includes(field.type)) {
    return String(value);
  }

  return String(value);
}

/** Converte o texto digitado no valor que a API aceita para o tipo do campo. */
export function parseFieldInput(field: CustomField, text: string): unknown {
  const trimmed = text.trim();

  if (trimmed === '') {
    return null;
  }

  if (NUMERIC_FIELD_TYPES.includes(field.type)) {
    const parsed = Number(trimmed.replace(/\./g, '').replace(',', '.'));

    if (!Number.isFinite(parsed)) {
      return null;
    }

    if (field.type === 'rating') {
      return clampInteger(parsed, 0, RATING_MAX);
    }

    if (field.type === 'progress') {
      return clampInteger(parsed, 0, PROGRESS_MAX);
    }

    return parsed;
  }

  if (field.type === 'date') {
    const date = new Date(`${trimmed}T12:00:00`);

    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return trimmed;
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/* Filtros da toolbar ----------------------------------------------------- */

export const FILTER_OP_LABEL: Record<FieldFilterOp, string> = {
  eq: 'É igual a',
  contains: 'Contém',
  gt: 'Maior que',
  lt: 'Menor que',
  isEmpty: 'Está vazio',
};

/** Operadores que fazem sentido para o tipo do campo. */
export function fieldFilterOps(type: CustomFieldType): FieldFilterOp[] {
  if (OPTION_FIELD_TYPES.includes(type) || type === 'checkbox') {
    return ['eq', 'isEmpty'];
  }

  if (TEXT_FIELD_TYPES.includes(type)) {
    return ['contains', 'isEmpty'];
  }

  if (NUMERIC_FIELD_TYPES.includes(type) || type === 'formula') {
    return ['eq', 'gt', 'lt', 'isEmpty'];
  }

  if (type === 'date') {
    return ['gt', 'lt', 'isEmpty'];
  }

  return ['isEmpty'];
}

/* Colunas da Lista ------------------------------------------------------- */

const COLUMN_PREFIX = 'field:';

export function fieldColumnKey(fieldId: string): string {
  return `${COLUMN_PREFIX}${fieldId}`;
}

export function fieldIdOfColumn(key: string): string | null {
  return key.startsWith(COLUMN_PREFIX) ? key.slice(COLUMN_PREFIX.length) : null;
}

export function isFieldColumnVisible(config: ViewConfig, fieldId: string): boolean {
  const column = (config.columns ?? []).find((item) => item.key === fieldColumnKey(fieldId));

  return column ? column.visible !== false : false;
}

/** Liga ou desliga a coluna do campo, respeitando o teto de colunas. */
export function toggleFieldColumn(config: ViewConfig, fieldId: string): ViewConfig {
  const key = fieldColumnKey(fieldId);
  const columns: ViewColumn[] = config.columns ?? [];
  const existing = columns.find((item) => item.key === key);

  if (existing) {
    return { ...config, columns: columns.filter((item) => item.key !== key) };
  }

  const visibleFields = columns.filter((item) => fieldIdOfColumn(item.key) !== null);

  if (visibleFields.length >= MAX_FIELD_COLUMNS) {
    return config;
  }

  return { ...config, columns: [...columns, { key, visible: true }] };
}

/** Campos escolhidos como coluna, na ordem da config e dentro do teto. */
export function fieldColumnsOf(config: ViewConfig, fields: CustomField[]): CustomField[] {
  const chosen: CustomField[] = [];

  for (const column of config.columns ?? []) {
    const fieldId = fieldIdOfColumn(column.key);
    const field = fieldId ? fields.find((item) => item.id === fieldId) : undefined;

    if (field && column.visible !== false) {
      chosen.push(field);
    }
  }

  return chosen.slice(0, MAX_FIELD_COLUMNS);
}
