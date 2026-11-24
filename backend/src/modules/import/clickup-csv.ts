import { readCsvTable } from '../../common/utils/csv-parse';
import { TaskPriority } from '../tasks/task-fields';

export interface ClickUpTask {
  line: number;
  externalId: string;
  name: string;
  descriptionText: string;
  statusName: string;
  priority: TaskPriority | null;
  assignees: string[];
  assigneeEmails: string[];
  tagNames: string[];
  dueAt: string | null;
  startAt: string | null;
  createdAt: string | null;
  completedAt: string | null;
  timeSpentMinutes: number | null;
  listName: string;
  folderPath: string[];
  spaceName: string;
  parentExternalId: string;
  subtasksExternalIds: string[];
  checklist: { name: string; items: string[] }[];
  comments: { text: string; by: string; date: string | null; resolved: boolean }[];
  attachments: { title: string; url: string }[];
  estimateMinutes: number | null;
  points: number | null;
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

const C = {
  id: ['task id'],
  name: ['task name', 'name'],
  content: ['task content'],
  status: ['status'],
  created: ['date created'],
  completed: ['date completed', 'date closed', 'date done'],
  due: ['due date'],
  start: ['start date'],
  parent: ['parent id'],
  subtasks: ['subtasks ids'],
  attachments: ['attachments'],
  assignees: ['assignees'],
  tags: ['tags'],
  priority: ['priority'],
  list: ['list name'],
  folder: ['folder name/path', 'folder name', 'folder', 'pasta'],
  space: ['space name'],
  checklists: ['checklists'],
  comments: ['comments'],
  time: ['time spent'],
  estimate: ['time estimate', 'time estimate text', 'estimate'],
  points: ['points', 'sprint points', 'story points'],
  location: ['home location'],
} as const;
const EMAIL = /^[\w.+-]+@[\w-]+\.[\w.-]+$/i;
const PRIORITIES: Record<string, TaskPriority> = {
  '1': 'urgent',
  urgent: 'urgent',
  urgente: 'urgent',
  '2': 'high',
  high: 'high',
  alta: 'high',
  '3': 'normal',
  normal: 'normal',
  '4': 'low',
  low: 'low',
  baixa: 'low',
};
export const FALLBACK_LIST_NAME = 'Importado do ClickUp';
export const MAX_IMPORT_ROWS = 5000;

export function parseClickUpCsv(content: string): ParsedClickUpCsv {
  const { rows } = readCsvTable(content);
  const tasks: ClickUpTask[] = [];
  const skipped: SkippedRow[] = [];
  rows.forEach((row, index) => {
    const line = index + 2;
    if (index >= MAX_IMPORT_ROWS) {
      skipped.push({ line, reason: 'LIMITE DE LINHAS EXCEDIDO' });
      return;
    }
    const name = pick(row, C.name);
    if (!name) {
      skipped.push({ line, reason: 'LINHA SEM NOME DE TAREFA' });
      return;
    }
    const assignees = parseBracketList(pick(row, C.assignees));
    const rawFolder = pick(row, C.folder);
    const folderPath = readFolderPath(rawFolder);
    tasks.push({
      line,
      externalId: pick(row, C.id),
      name: name.slice(0, 500),
      descriptionText: pick(row, C.content).slice(0, 20_000),
      statusName: pick(row, C.status),
      priority: parsePriority(pick(row, C.priority)),
      assignees,
      assigneeEmails: assignees.filter((a) => EMAIL.test(a)).map((a) => a.toLowerCase()),
      tagNames: parseBracketList(pick(row, C.tags)).slice(0, 20),
      dueAt: readDate(pick(row, C.due)),
      startAt: readDate(pick(row, C.start)),
      createdAt: readDate(pick(row, C.created)),
      completedAt: readDate(pick(row, C.completed)),
      timeSpentMinutes: readDuration(pick(row, C.time)),
      listName: pick(row, C.list) || FALLBACK_LIST_NAME,
      folderPath,
      folderName: folderPath.at(-1) ?? '',
      spaceName: pick(row, C.space),
      parentExternalId: pick(row, C.parent),
      subtasksExternalIds: parseBracketList(pick(row, C.subtasks)),
      checklist: parseChecklists(pick(row, C.checklists)),
      comments: parseComments(pick(row, C.comments)),
      attachments: parseAttachments(pick(row, C.attachments)),
      estimateMinutes: readDuration(pick(row, C.estimate)),
      points: readNumber(pick(row, C.points)),
    });
  });
  const ids = new Map(tasks.filter((t) => t.externalId).map((t) => [t.externalId, t]));
  for (const parent of tasks)
    for (const childId of parent.subtasksExternalIds) {
      const child = ids.get(childId);
      if (child && !child.parentExternalId) child.parentExternalId = parent.externalId;
    }
  for (const task of tasks)
    if (task.parentExternalId && !ids.has(task.parentExternalId)) task.parentExternalId = '';
  return { tasks, skipped };
}

function pick(row: Record<string, string>, keys: readonly string[]): string {
  for (const key of keys) {
    const v = row[key.toLowerCase()];
    if (v?.trim()) return v.trim();
  }
  return '';
}
function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function readFolderPath(value: string): string[] {
  const parsed = parseJson(value);
  const path = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object'
      ? ((parsed as Record<string, unknown>).path ??
        (parsed as Record<string, unknown>).names ??
        (parsed as Record<string, unknown>).name ??
        (parsed as Record<string, unknown>).folderName)
      : parsed;
  const parts = Array.isArray(path)
    ? path.map(String)
    : typeof path === 'string'
      ? path.split('/')
      : value
          .replace(/^\s*\[/, '')
          .replace(/\]\s*$/, '')
          .split('/');
  return parts.map((part) => part.trim()).filter(Boolean);
}
function parseBracketList(value: string): string[] {
  const parsed = parseJson(value);
  if (Array.isArray(parsed))
    return [
      ...new Set(
        parsed
          .map(String)
          .map((x) => x.trim())
          .filter(Boolean),
      ),
    ];
  return [
    ...new Set(
      value
        .replace(/^\s*\[/, '')
        .replace(/\]\s*$/, '')
        .split(',')
        .map((x) => x.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean),
    ),
  ];
}
function parsePriority(value: string): TaskPriority | null {
  return PRIORITIES[value.trim().toLowerCase()] ?? null;
}
export function readDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const n = Number(v);
  const date = /^\d{10,13}$/.test(v) ? new Date(v.length === 10 ? n * 1000 : n) : new Date(v);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function readDuration(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const n = Number(v);
  if (Number.isFinite(n)) return Math.min(100_000, Math.max(0, Math.round(n / 60_000)));
  const match = /(?:(\d+)h)?\s*(?:(\d+)m)?/i.exec(v);
  return match && (match[1] || match[2])
    ? Math.min(100_000, Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0))
    : null;
}

function readNumber(value: string): number | null {
  const parsed = Number(value.trim().replace(',', '.'));

  return value.trim().length > 0 && Number.isFinite(parsed)
    ? Math.min(1000, Math.max(0, Math.round(parsed)))
    : null;
}
function parseChecklists(value: string): { name: string; items: string[] }[] {
  const data = parseJson(value);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  return Object.entries(data).map(([name, items]) => ({
    name,
    items: Array.isArray(items) ? items.map(String) : [],
  }));
}
function parseComments(value: string): ClickUpTask['comments'] {
  const data = parseJson(value);
  if (!Array.isArray(data)) return [];
  return data.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const c = item as Record<string, unknown>;
    const text = String(c.text ?? '').trim();
    return text
      ? [
          {
            text,
            by: String(c['by(e-mail)'] ?? c.by ?? ''),
            date: readDate(String(c.date ?? '')),
            resolved: c.resolved === true || c.resolved === 'true',
          },
        ]
      : [];
  });
}
function parseAttachments(value: string): ClickUpTask['attachments'] {
  const data = parseJson(value);
  if (!Array.isArray(data)) return [];
  return data.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const a = item as Record<string, unknown>;
    return a.url ? [{ title: String(a.title ?? 'Anexo'), url: String(a.url) }] : [];
  });
}
