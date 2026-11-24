import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from '@jest/globals';
import { parseClickUpCsv } from './clickup-csv';

describe('parseClickUpCsv with the anonymized ClickUp export fixture', () => {
  it('reads ten rows and normalizes dates, JSON columns, lists, and hierarchy', () => {
    const csv = readFileSync(
      join(process.cwd(), 'test/fixtures/clickup-export-anonymized.csv'),
      'utf8',
    );
    const parsed = parseClickUpCsv(csv);

    expect(parsed.tasks).toHaveLength(10);
    expect(parsed.skipped).toEqual([]);
    expect(parsed.tasks[0]).toMatchObject({
      externalId: 'cu-001',
      name: 'Tarefa 1',
      statusName: 'to do',
      assignees: ['Pessoa Um'],
      tagNames: ['planejamento'],
      folderPath: ['Produto', 'Planejamento'],
      spaceName: 'Espaço A',
      checklist: [{ name: 'Revisão', items: ['Escopo', 'Prazo'] }],
      comments: [
        {
          text: 'Comentário anonimizado',
          by: 'pessoa@example.invalid',
          date: '2025-01-01T10:00:00.000Z',
          resolved: true,
        },
      ],
      attachments: [{ title: 'Guia', url: 'https://example.invalid/1' }],
      timeSpentMinutes: 60,
      parentExternalId: '',
    });
    expect(parsed.tasks[1]?.parentExternalId).toBe('cu-001');
    expect(parsed.tasks[0]?.createdAt).toBe('2025-01-01T00:00:00.000Z');
    expect(parsed.tasks[0]?.dueAt).toBe('2025-01-05T00:00:00.000Z');
    expect(parsed.tasks[0]?.startAt).toBe('2025-01-02T00:00:00.000Z');
  });
});
