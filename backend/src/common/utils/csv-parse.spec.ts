import { parseCsv, readCsvTable } from './csv-parse';

describe('parseCsv', () => {
  it('reads quoted fields, doubled quotes and line breaks inside quotes', () => {
    expect(parseCsv('a,"b,c","d""e"\r\n1,"linha\nquebrada",3\r\n')).toEqual([
      ['a', 'b,c', 'd"e'],
      ['1', 'linha\nquebrada', '3'],
    ]);
  });

  it('drops the BOM of the first cell', () => {
    expect(parseCsv('\ufeffName\n')).toEqual([['Name']]);
  });
});

describe('readCsvTable', () => {
  it('keys the rows by the lowercased header and skips blank lines', () => {
    const table = readCsvTable('Task Name,Status\n\nFazer ,  A fazer\n');

    expect(table.headers).toEqual(['task name', 'status']);
    expect(table.rows).toEqual([{ 'task name': 'Fazer', status: 'A fazer' }]);
  });

  it('returns nothing for an empty file', () => {
    expect(readCsvTable('')).toEqual({ headers: [], rows: [] });
  });
});
