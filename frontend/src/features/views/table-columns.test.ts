import { describe, expect, it } from 'vitest';
import type { CustomField, ViewConfig } from '@/api/types';
import {
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  TASK_COLUMN_KEYS,
  canHideColumn,
  moveColumn,
  setColumnWidth,
  tableColumns,
  tableState,
  toggleColumn,
  withColumns,
} from './table-columns';

function field(id: string, name: string): CustomField {
  return { id, name, type: 'text', config: {} } as CustomField;
}

const FIELDS = [field('f1', 'Cliente')];

describe('tableColumns', () => {
  it('sem config traz as colunas da tarefa na ordem padrão e o campo escondido', () => {
    const columns = tableColumns({}, FIELDS);

    expect(columns.map((column) => column.key)).toEqual([...TASK_COLUMN_KEYS, 'field:f1']);
    expect(columns.every((column) => column.width > 0)).toBe(true);
    expect(columns.find((column) => column.key === 'field:f1')?.visible).toBe(false);
    expect(columns.find((column) => column.key === 'name')?.visible).toBe(true);
  });

  it('respeita a ordem, a largura e a visibilidade guardadas na view', () => {
    const config: ViewConfig = {
      columns: [
        { key: 'dueAt', width: 200, visible: true },
        { key: 'name', visible: true },
        { key: 'field:f1', visible: true },
      ],
    };
    const columns = tableColumns(config, FIELDS);

    expect(columns.slice(0, 3).map((column) => column.key)).toEqual(['dueAt', 'name', 'field:f1']);
    expect(columns[0]?.width).toBe(200);
    expect(columns[2]?.label).toBe('Cliente');
  });

  it('descarta coluna de campo que não existe mais e nunca esconde o nome', () => {
    const config: ViewConfig = {
      columns: [
        { key: 'field:apagado', visible: true },
        { key: 'name', visible: false },
      ],
    };
    const columns = tableColumns(config, FIELDS);

    expect(columns.some((column) => column.key === 'field:apagado')).toBe(false);
    expect(columns[0]?.key).toBe('name');
    expect(columns[0]?.visible).toBe(true);
    expect(canHideColumn('name')).toBe(false);
  });
});

describe('mudanças nas colunas', () => {
  it('a largura entra nos limites', () => {
    const columns = tableColumns({}, FIELDS);

    expect(setColumnWidth(columns, 'name', 10)[1]?.width).toBe(MIN_COLUMN_WIDTH);
    expect(setColumnWidth(columns, 'name', 9000)[1]?.width).toBe(MAX_COLUMN_WIDTH);
    expect(setColumnWidth(columns, 'name', 300)[1]?.width).toBe(300);
  });

  it('esconder e mostrar, menos a coluna do nome', () => {
    const columns = tableColumns({}, FIELDS);
    const hidden = toggleColumn(columns, 'dueAt');

    expect(hidden.find((column) => column.key === 'dueAt')?.visible).toBe(false);
    expect(toggleColumn(hidden, 'dueAt').find((column) => column.key === 'dueAt')?.visible).toBe(
      true,
    );
    expect(toggleColumn(columns, 'name').find((column) => column.key === 'name')?.visible).toBe(
      true,
    );
  });

  it('mover troca com a vizinha e para nas pontas', () => {
    const columns = tableColumns({}, FIELDS);
    const moved = moveColumn(columns, 'name', -1);

    expect(moved.map((column) => column.key).slice(0, 2)).toEqual(['name', 'customId']);
    expect(moveColumn(columns, 'customId', -1)).toEqual(columns);
    expect(moveColumn(columns, 'field:f1', 1)).toEqual(columns);
  });

  it('withColumns grava ordem, largura e visibilidade na config', () => {
    const columns = setColumnWidth(toggleColumn(tableColumns({}, FIELDS), 'tags'), 'name', 320);
    const config = withColumns({ groupBy: 'none' }, columns);

    expect(config.groupBy).toBe('none');
    expect(config.columns?.[1]).toEqual({ key: 'name', width: 320, visible: true });
    expect(config.columns?.find((column) => column.key === 'tags')?.visible).toBe(false);
  });
});

describe('tableState', () => {
  it('vira a ordem, as larguras e a visibilidade que a tabela recebe', () => {
    const state = tableState(tableColumns({}, FIELDS));

    expect(state.columnOrder[0]).toBe('customId');
    expect(state.columnSizing.name).toBeGreaterThan(0);
    expect(state.columnVisibility['field:f1']).toBe(false);
  });
});
