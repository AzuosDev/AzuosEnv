export type CsvCell = string | number | null | undefined;

const CSV_BOM = '\ufeff';

export const CSV_CONTENT_TYPE = 'text/csv; charset=utf-8';

/** Spreadsheet-friendly CSV: BOM, CRLF and every text cell quoted. */
export function toCsvBuffer(columns: string[], rows: CsvCell[][]): Buffer {
  const lines = [columns.map((column) => csvCell(column)).join(',')];

  for (const row of rows) {
    lines.push(row.map((cell) => csvCell(cell)).join(','));
  }

  return Buffer.from(`${CSV_BOM}${lines.join('\r\n')}\r\n`, 'utf8');
}

function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return `"${value.replace(/"/g, '""')}"`;
}
