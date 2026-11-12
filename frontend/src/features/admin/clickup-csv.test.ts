import { describe, expect, it } from 'vitest';
import { FALLBACK_LIST_NAME, parseCsv, previewClickUpCsv } from './clickup-csv';

const CSV = [
  'Task Name,Status,Assignees,Tags,List Name,Folder Name,Comentarios',
  '"Ajustar PDV, urgente",Em andamento,"ana@azuos.dev, bruno@azuos.dev",bug,Entregas,Clientes,3',
  'Revisar contrato,Aberto,ana@azuos.dev,"contrato, juridico",Entregas,Clientes,',
  ',Aberto,ana@azuos.dev,,Entregas,Clientes,',
  'Sem lista,Concluído,,,,,',
].join('\n');

describe('parseCsv', () => {
  it('lê vírgula dentro de aspas e normaliza o cabeçalho', () => {
    const table = parseCsv(CSV);

    expect(table.headers[0]).toBe('Task Name');
    expect(table.rows).toHaveLength(4);
    expect(table.rows[0]?.['task name']).toBe('Ajustar PDV, urgente');
    expect(table.rows[0]?.assignees).toBe('ana@azuos.dev, bruno@azuos.dev');
  });

  it('aceita CRLF, BOM e aspas escapadas', () => {
    const table = parseCsv('﻿Task Name\r\n"Diz ""oi"""\r\n');

    expect(table.headers).toEqual(['Task Name']);
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]?.['task name']).toBe('Diz "oi"');
  });
});

describe('previewClickUpCsv', () => {
  it('mostra Lists, statuses, responsáveis e o que será ignorado', () => {
    const preview = previewClickUpCsv(CSV);

    expect(preview.rows).toBe(4);
    expect(preview.lists).toEqual(['Entregas', FALLBACK_LIST_NAME]);
    expect(preview.folders).toEqual(['Clientes']);
    expect(preview.statuses).toEqual(['Em andamento', 'Aberto', 'Concluído']);
    expect(preview.emails).toEqual(['ana@azuos.dev', 'bruno@azuos.dev']);
    expect(preview.tags).toEqual(['bug', 'contrato', 'juridico']);
    expect(preview.skipped).toEqual([{ line: 4, reason: 'Linha sem nome de tarefa' }]);
    expect(preview.ignoredColumns).toEqual(['Comentarios']);
  });

  it('arquivo só com cabeçalho não tem nada para importar', () => {
    const preview = previewClickUpCsv('Task Name,Status');

    expect(preview.rows).toBe(0);
    expect(preview.lists).toEqual([]);
  });
});
