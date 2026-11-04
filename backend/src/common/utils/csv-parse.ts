/**
 * Minimal RFC 4180 reader, enough for the CSV that ClickUp exports: quoted fields,
 * doubled quotes inside them, commas and line breaks inside quotes, and CRLF.
 */
export function parseCsv(content: string): string[][] {
  const text = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let started = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }

      continue;
    }

    if (char === '"') {
      quoted = true;
      started = true;

      continue;
    }

    if (char === ',') {
      row.push(field);
      field = '';
      started = true;

      continue;
    }

    if (char === '\r') {
      continue;
    }

    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      started = false;

      continue;
    }

    field += char;
    started = true;
  }

  if (started || field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/** Rows of the file as records keyed by the header, lowercased and trimmed. */
export interface CsvTable {
  headers: string[];
  rows: Record<string, string>[];
}

export function readCsvTable(content: string): CsvTable {
  const rows = parseCsv(content).filter((row) => row.some((cell) => cell.trim().length > 0));
  const [header, ...body] = rows;

  if (!header) {
    return { headers: [], rows: [] };
  }

  const headers = header.map((cell) => cell.trim().toLowerCase());

  return {
    headers,
    rows: body.map((cells) => {
      const record: Record<string, string> = {};

      headers.forEach((key, index) => {
        record[key] = (cells[index] ?? '').trim();
      });

      return record;
    }),
  };
}
