export interface CsvTable {
  headers: string[];
  rows: Record<string, string>[];
}
export interface ImportPreview {
  rows: number;
  taskCount: number;
  lists: string[];
  folders: string[];
  spaces: string[];
  statuses: string[];
  people: string[];
  tags: string[];
  skipped: { line: number; reason: string }[];
  ignoredColumns: string[];
}
const C = {
  name: 'task name',
  status: 'status',
  assignees: 'assignees',
  tags: 'tags',
  list: 'list name',
  folder: 'folder name/path',
  space: 'space name',
};
const KNOWN = new Set([
  'task id',
  C.name,
  'task content',
  C.status,
  'date created',
  'due date',
  'start date',
  'parent id',
  'subtasks ids',
  'attachments',
  C.assignees,
  C.tags,
  'priority',
  C.list,
  C.folder,
  'folder name',
  C.space,
  'checklists',
  'comments',
  'time spent',
  'home location',
]);
export const FALLBACK_LIST_NAME = 'Importado do ClickUp';
export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export function parseCsv(content: string): CsvTable {
  const text = content.replace(/^\uFEFF/u, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i += 1;
        } else quoted = false;
      } else value += char;
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ',') {
      row.push(value);
      value = '';
      continue;
    }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
      continue;
    }
    value += char;
  }
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  const [head = [], ...body] = rows.filter((cells) => cells.length > 1 || (cells[0] ?? '').trim());
  const headers = head.map((cell) => cell.trim());
  return {
    headers,
    rows: body.map(
      (cells) =>
        Object.fromEntries(
          headers.map((key, i) => [key.toLowerCase(), (cells[i] ?? '').trim()]),
        ) as Record<string, string>,
    ),
  };
}
function arrayValue(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed))
      return parsed
        .map(String)
        .map((s) => s.trim())
        .filter(Boolean);
  } catch {
    /* ClickUp Assignees and Tags are bracketed text, not JSON. */
  }
  return value
    .replace(/^\s*\[/, '')
    .replace(/\]\s*$/, '')
    .split(',')
    .map((part) => part.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}
function add(into: string[], value: string): void {
  if (value && !into.includes(value)) into.push(value);
}
export function previewClickUpCsv(content: string): ImportPreview {
  const table = parseCsv(content);
  const preview: ImportPreview = {
    rows: table.rows.length,
    taskCount: 0,
    lists: [],
    folders: [],
    spaces: [],
    statuses: [],
    people: [],
    tags: [],
    skipped: [],
    ignoredColumns: table.headers.filter((header) => header && !KNOWN.has(header.toLowerCase())),
  };
  table.rows.forEach((row, index) => {
    const line = index + 2;
    if (index >= MAX_IMPORT_ROWS) {
      preview.skipped.push({ line, reason: 'Acima do limite de 5000 linhas' });
      return;
    }
    if (!row[C.name]) {
      preview.skipped.push({ line, reason: 'Linha sem nome de tarefa' });
      return;
    }
    preview.taskCount += 1;
    add(preview.lists, row[C.list] || FALLBACK_LIST_NAME);
    add(preview.spaces, row[C.space] ?? '');
    add(preview.statuses, row[C.status] ?? '');
    const folder = row[C.folder] ?? row['folder name'] ?? '';
    try {
      const parsed: unknown = JSON.parse(folder);
      const path = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object'
          ? ((parsed as Record<string, unknown>).path ??
            (parsed as Record<string, unknown>).names ??
            (parsed as Record<string, unknown>).name ??
            (parsed as Record<string, unknown>).folderName)
          : parsed;
      if (Array.isArray(path)) path.forEach((part) => add(preview.folders, String(part)));
      else if (typeof path === 'string')
        path.split('/').forEach((part) => add(preview.folders, part.trim()));
    } catch {
      folder.split('/').forEach((part) => add(preview.folders, part.trim()));
    }
    arrayValue(row[C.assignees] ?? '').forEach((person) => add(preview.people, person));
    arrayValue(row[C.tags] ?? '').forEach((tag) => add(preview.tags, tag));
  });
  return preview;
}
