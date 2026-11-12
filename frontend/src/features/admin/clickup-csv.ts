/**
 * Prévia do CSV do ClickUp antes de importar. Lê as mesmas colunas que o
 * backend lê (src/modules/import/clickup-csv.ts) para mostrar o que vai virar
 * List, status e responsável — o import de verdade continua no servidor.
 */

export interface CsvTable {
  headers: string[];
  rows: Record<string, string>[];
}

export interface ImportPreview {
  /** Linhas de dados do arquivo, sem o cabeçalho. */
  rows: number;
  /** Nomes de List encontrados, em ordem de aparição. */
  lists: string[];
  folders: string[];
  statuses: string[];
  /** E-mails de responsável; o servidor casa cada um com a conta do workspace. */
  emails: string[];
  tags: string[];
  /** Linhas que o servidor vai ignorar: sem nome de tarefa. */
  skipped: { line: number; reason: string }[];
  /** Colunas do arquivo que a importação não usa. */
  ignoredColumns: string[];
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

const KNOWN_COLUMNS = Object.values(COLUMNS).flat() as string[];

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

export const FALLBACK_LIST_NAME = 'Importado do ClickUp';
export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** CSV com vírgula, aspas duplas e aspas escapadas por duplicação. */
export function parseCsv(content: string): CsvTable {
  const text = content.replace(/^\uFEFF/u, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        value += char;
      }

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
      if (char === '\r' && text[index + 1] === '\n') {
        index += 1;
      }

      row.push(value);
      rows.push(row);
      row = [];
      value = '';

      continue;
    }

    value += char;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  const [header = [], ...body] = rows.filter(
    (line) => line.length > 1 || (line[0] ?? '').trim().length > 0,
  );
  const headers = header.map((cell) => cell.trim());

  return {
    headers,
    rows: body.map((line) => {
      const record: Record<string, string> = {};

      headers.forEach((key, index) => {
        record[key.toLowerCase()] = (line[index] ?? '').trim();
      });

      return record;
    }),
  };
}

function pick(row: Record<string, string>, names: readonly string[]): string {
  for (const name of names) {
    const value = row[name];

    if (value !== undefined && value.length > 0) {
      return value;
    }
  }

  return '';
}

function push(into: string[], value: string): void {
  if (value.length > 0 && !into.includes(value)) {
    into.push(value);
  }
}

/** O que o arquivo vai criar, para a pessoa conferir antes de importar. */
export function previewClickUpCsv(content: string): ImportPreview {
  const table = parseCsv(content);
  const preview: ImportPreview = {
    rows: table.rows.length,
    lists: [],
    folders: [],
    statuses: [],
    emails: [],
    tags: [],
    skipped: [],
    ignoredColumns: table.headers.filter(
      (header) => header.length > 0 && !KNOWN_COLUMNS.includes(header.toLowerCase()),
    ),
  };

  table.rows.forEach((row, index) => {
    const line = index + 2;

    if (index >= MAX_IMPORT_ROWS) {
      preview.skipped.push({ line, reason: 'Acima do limite de 5000 linhas' });

      return;
    }

    if (pick(row, COLUMNS.name).length === 0) {
      preview.skipped.push({ line, reason: 'Linha sem nome de tarefa' });

      return;
    }

    push(preview.lists, pick(row, COLUMNS.list) || FALLBACK_LIST_NAME);
    push(preview.folders, pick(row, COLUMNS.folder));
    push(preview.statuses, pick(row, COLUMNS.status));

    for (const email of pick(row, COLUMNS.assignees).match(EMAIL) ?? []) {
      push(preview.emails, email.toLowerCase());
    }

    for (const tag of pick(row, COLUMNS.tags).split(',')) {
      push(preview.tags, tag.trim());
    }
  });

  return preview;
}
