import type { CustomField, ViewColumn, ViewConfig } from '@/api/types';
import { fieldColumnKey, fieldIdOfColumn } from '@/features/tasks/field-values';

/** Colunas da tarefa que a Tabela conhece, na ordem padrão. */
export const TASK_COLUMN_KEYS = [
  'customId',
  'name',
  'status',
  'assignees',
  'startAt',
  'dueAt',
  'estimate',
  'priority',
  'tags',
] as const;
export type TaskColumnKey = (typeof TASK_COLUMN_KEYS)[number];

export const TASK_COLUMN_LABEL: Record<TaskColumnKey, string> = {
  customId: 'ID',
  name: 'Tarefa',
  status: 'Status',
  assignees: 'Responsáveis',
  startAt: 'Início',
  dueAt: 'Prazo',
  estimate: 'Estimativa',
  priority: 'Prioridade',
  tags: 'Tags',
};

const DEFAULT_WIDTH: Record<TaskColumnKey, number> = {
  customId: 96,
  name: 280,
  status: 160,
  assignees: 180,
  startAt: 128,
  dueAt: 128,
  estimate: 120,
  priority: 140,
  tags: 180,
};

/** Largura de coluna de campo personalizado. */
export const FIELD_COLUMN_WIDTH = 160;

export const MIN_COLUMN_WIDTH = 72;
export const MAX_COLUMN_WIDTH = 520;

/** A coluna do nome é a identidade da linha: nunca pode ser escondida. */
const ALWAYS_VISIBLE: string[] = ['name'];

export interface TableColumnState {
  key: string;
  label: string;
  width: number;
  visible: boolean;
  /** Preenchido só nas colunas de campo personalizado. */
  field: CustomField | null;
}

function isKnown(key: string, fields: CustomField[]): boolean {
  if ((TASK_COLUMN_KEYS as readonly string[]).includes(key)) {
    return true;
  }

  const fieldId = fieldIdOfColumn(key);

  return fieldId !== null && fields.some((field) => field.id === fieldId);
}

function defaultWidth(key: string): number {
  return (TASK_COLUMN_KEYS as readonly string[]).includes(key)
    ? DEFAULT_WIDTH[key as TaskColumnKey]
    : FIELD_COLUMN_WIDTH;
}

function labelOf(key: string, fields: CustomField[]): string {
  if ((TASK_COLUMN_KEYS as readonly string[]).includes(key)) {
    return TASK_COLUMN_LABEL[key as TaskColumnKey];
  }

  const fieldId = fieldIdOfColumn(key);

  return fields.find((field) => field.id === fieldId)?.name ?? 'Campo';
}

function fieldOf(key: string, fields: CustomField[]): CustomField | null {
  const fieldId = fieldIdOfColumn(key);

  return fieldId === null ? null : (fields.find((field) => field.id === fieldId) ?? null);
}

/**
 * Colunas da Tabela: a ordem, a largura e o que está visível saem de
 * `config.columns`; o que não está lá entra depois, na ordem padrão. Coluna
 * guardada que não existe mais (campo apagado) é descartada.
 */
export function tableColumns(config: ViewConfig, fields: CustomField[]): TableColumnState[] {
  const saved = (config.columns ?? []).filter((column) => isKnown(column.key, fields));
  const used = new Set(saved.map((column) => column.key));
  const rest: string[] = [
    ...TASK_COLUMN_KEYS.filter((key) => !used.has(key)),
    ...fields.map((field) => fieldColumnKey(field.id)).filter((key) => !used.has(key)),
  ];

  return [
    ...saved.map((column) => ({
      key: column.key,
      label: labelOf(column.key, fields),
      width: column.width ?? defaultWidth(column.key),
      visible: ALWAYS_VISIBLE.includes(column.key) || column.visible !== false,
      field: fieldOf(column.key, fields),
    })),
    ...rest.map((key) => ({
      key,
      label: labelOf(key, fields),
      width: defaultWidth(key),
      // Campo personalizado só entra na Tabela quando a pessoa liga a coluna.
      visible: fieldIdOfColumn(key) === null,
      field: fieldOf(key, fields),
    })),
  ];
}

/** Grava a lista inteira na config: ordem, largura e visibilidade de uma vez. */
function toViewColumns(columns: TableColumnState[]): ViewColumn[] {
  return columns.map((column) => ({
    key: column.key,
    width: column.width,
    visible: column.visible,
  }));
}

export function withColumns(config: ViewConfig, columns: TableColumnState[]): ViewConfig {
  return { ...config, columns: toViewColumns(columns) };
}

export function clampColumnWidth(width: number): number {
  return Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, Math.round(width)));
}

export function setColumnWidth(
  columns: TableColumnState[],
  key: string,
  width: number,
): TableColumnState[] {
  return columns.map((column) =>
    column.key === key ? { ...column, width: clampColumnWidth(width) } : column,
  );
}

/** Larguras que a tabela devolveu depois de arrastar a alça. */
export function applySizing(
  columns: TableColumnState[],
  sizing: Record<string, number>,
): TableColumnState[] {
  return columns.map((column) => {
    const width = sizing[column.key];

    return width === undefined ? column : { ...column, width: clampColumnWidth(width) };
  });
}

export function canHideColumn(key: string): boolean {
  return !ALWAYS_VISIBLE.includes(key);
}

export function toggleColumn(columns: TableColumnState[], key: string): TableColumnState[] {
  if (!canHideColumn(key)) {
    return columns;
  }

  return columns.map((column) =>
    column.key === key ? { ...column, visible: !column.visible } : column,
  );
}

/** Troca a coluna de lugar com a vizinha; fora da lista nada muda. */
export function moveColumn(
  columns: TableColumnState[],
  key: string,
  delta: -1 | 1,
): TableColumnState[] {
  const at = columns.findIndex((column) => column.key === key);
  const to = at + delta;

  if (at < 0 || to < 0 || to >= columns.length) {
    return columns;
  }

  const next = [...columns];
  const moved = next[at];
  const other = next[to];

  if (!moved || !other) {
    return columns;
  }

  next[at] = other;
  next[to] = moved;

  return next;
}

/** Estado que a TanStack Table recebe, derivado das colunas da view. */
export function tableState(columns: TableColumnState[]): {
  columnOrder: string[];
  columnSizing: Record<string, number>;
  columnVisibility: Record<string, boolean>;
} {
  return {
    columnOrder: columns.map((column) => column.key),
    columnSizing: Object.fromEntries(columns.map((column) => [column.key, column.width])),
    columnVisibility: Object.fromEntries(columns.map((column) => [column.key, column.visible])),
  };
}
