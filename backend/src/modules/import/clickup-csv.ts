import { readCsvTable } from '../../common/utils/csv-parse';
import { TaskPriority } from '../tasks/task-fields';

/** One task read from the CSV, already normalized; ids are resolved by the service. */
export interface ClickUpTask {
  /** Line of the file (the header is line 1), used in the report. */
  line: number;
  name: string;
  descriptionText: string;
  statusName: string;
  priority: TaskPriority | null;
  assigneeEmails: string[];
  tagNames: string[];
  dueAt: string | null;
  startAt: string | null;
  estimateMinutes: number | null;
  points: number | null;
  listName: string;
  folderName: string;
}

export interface SkippedRow {
  line: number;
  reason: string;
}

export interface ParsedClickUpCsv {
  tasks: ClickUpTask[];
  skipped: SkippedRow[];
}

const COLUMNS = {
  name: ['task name', 'name', 'nome', 'nome da tarefa'],
  content: ['task content', 'description', 'content', 'descrição'],
  status: ['status'],
  priority: ['priority', 'prioridade'],
  assignees: ['assignees', 'assignee', 'responsáveis', 'responsavel'],
  tags: ['tags', 'etiquetas'],
  due: ['due date', 'due date text', 'duedate', 'data de entrega'],
  start: ['start date', 'start date text', 'startdate', 'data de início'],
  estimate: ['time estimate', 'time estimate text', 'estimate'],
  points: ['points', 'sprint points', 'story points'],
  list: ['list name', 'list', 'lists', 'lista'],
  folder: ['folder name', 'folder', 'pasta'],
} as const;

const PRIORITY_BY_LABEL = new Map<string, TaskPriority>([
  ['urgent', 'urgent'],
  ['urgente', 'urgent'],
  ['1', 'urgent'],
  ['high', 'high'],
  ['alta', 'high'],
  ['2', 'high'],
  ['normal', 'normal'],
  ['media', 'normal'],
  ['média', 'normal'],
  ['3', 'normal'],
  ['low', 'low'],
  ['baixa', 'low'],
  ['4', 'low'],
]);

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const MINUTE_MS = 60_000;

export const FALLBACK_LIST_NAME = 'Importado do ClickUp';
export const MAX_IMPORT_ROWS = 5000;

/** Reads the export of ClickUp; a row without a name is reported, never imported. */
export function parseClickUpCsv(content: string): ParsedClickUpCsv {
  const { rows } = readCsvTable(content);
  const tasks: ClickUpTask[] = [];
  const skipped: SkippedRow[] = [];

  rows.forEach((row, index) => {
    const line = index + 2;

    if (tasks.length >= MAX_IMPORT_ROWS) {
      skipped.push({ line, reason: 'LIMITE DE LINHAS EXCEDIDO' });

      return;
    }

    const name = pick(row, COLUMNS.name);

    if (!name) {
      skipped.push({ line, reason: 'LINHA SEM NOME DE TAREFA' });

      return;
    }

    tasks.push({
      line,
      name: name.slice(0, 500),
      descriptionText: pick(row, COLUMNS.content).slice(0, 20_000),
      statusName: pick(row, COLUMNS.status),
      priority: readPriority(pick(row, COLUMNS.priority)),
      assigneeEmails: readEmails(pick(row, COLUMNS.assignees)),
      tagNames: readList(pick(row, COLUMNS.tags)).slice(0, 20),
      dueAt: readDate(pick(row, COLUMNS.due)),
      startAt: readDate(pick(row, COLUMNS.start)),
      estimateMinutes: clamp(readEstimate(pick(row, COLUMNS.estimate)), 0, 100_000),
      points: clamp(readNumber(pick(row, COLUMNS.points)), 0, 1000),
      listName: pick(row, COLUMNS.list) || FALLBACK_LIST_NAME,
      folderName: pick(row, COLUMNS.folder),
    });
  });

  return { tasks, skipped };
}

function pick(row: Record<string, string>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = row[key];

    if (value !== undefined && value.length > 0) {
      return value;
    }
  }

  return '';
}

export function readPriority(value: string): TaskPriority | null {
  return PRIORITY_BY_LABEL.get(value.trim().toLowerCase()) ?? null;
}

export function readEmails(value: string): string[] {
  return [...new Set((value.toLowerCase().match(EMAIL) ?? []).map((email) => email.trim()))].slice(
    0,
    20,
  );
}

/** `[a,b]`, `a, b` and `a;b` all read as two items. */
export function readList(value: string): string[] {
  return [
    ...new Set(
      value
        .replace(/^[[\s]+|[\]\s]+$/g, '')
        .split(/[,;|]/)
        .map((item) => item.replace(/^["'\s]+|["'\s]+$/g, ''))
        .filter((item) => item.length > 0),
    ),
  ];
}

/** ClickUp writes epoch milliseconds; a human-readable date is accepted too. */
export function readDate(value: string): string | null {
  const text = value.trim();

  if (text.length === 0) {
    return null;
  }

  if (/^\d{10}$/.test(text)) {
    return new Date(Number(text) * 1000).toISOString();
  }

  if (/^\d{13}$/.test(text)) {
    return new Date(Number(text)).toISOString();
  }

  const parsed = Date.parse(text);

  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

/** The estimate of ClickUp is in milliseconds; `3h 30m` is also understood. */
export function readEstimate(value: string): number | null {
  const text = value.trim();

  if (text.length === 0) {
    return null;
  }

  if (/^\d+$/.test(text)) {
    const milliseconds = Number(text);

    return milliseconds >= MINUTE_MS ? Math.round(milliseconds / MINUTE_MS) : milliseconds;
  }

  const hours = /(\d+(?:[.,]\d+)?)\s*h/i.exec(text);
  const minutes = /(\d+)\s*m/i.exec(text);

  if (!hours && !minutes) {
    return null;
  }

  const fromHours = hours ? Number(hours[1].replace(',', '.')) * 60 : 0;
  const fromMinutes = minutes ? Number(minutes[1]) : 0;

  return Math.round(fromHours + fromMinutes) || null;
}

/** Keeps the value inside the range the task DTO accepts, as an integer. */
export function clamp(value: number | null, min: number, max: number): number | null {
  if (value === null) {
    return null;
  }

  return Math.min(Math.max(Math.round(value), min), max);
}

export function readNumber(value: string): number | null {
  const text = value.trim().replace(',', '.');

  if (text.length === 0) {
    return null;
  }

  const parsed = Number(text);

  return Number.isFinite(parsed) ? parsed : null;
}
