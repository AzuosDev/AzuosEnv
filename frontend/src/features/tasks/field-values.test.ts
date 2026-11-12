import { describe, expect, it } from 'vitest';
import type { CustomField, CustomFieldType, TaskFieldValue, ViewConfig } from '@/api/types';
import {
  fieldColumnKey,
  fieldColumnsOf,
  fieldFilterOps,
  fieldIdOfColumn,
  fieldInputText,
  fieldValueOf,
  formatFieldValue,
  isEmptyFieldValue,
  isFieldColumnVisible,
  isReadOnlyField,
  parseFieldInput,
  toggleFieldColumn,
  withFieldValue,
} from './field-values';

function field(id: string, type: CustomFieldType, config: CustomField['config'] = {}): CustomField {
  return {
    id,
    workspaceId: 'w1',
    scope: 'list',
    scopeId: 'l1',
    name: `Campo ${id}`,
    type,
    config,
    required: false,
    position: 'a',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as CustomField;
}

const dropdown = field('f1', 'dropdown', {
  options: [
    { id: 'o1', name: 'Bug' },
    { id: 'o2', name: 'Melhoria' },
  ],
});

describe('isEmptyFieldValue', () => {
  it('trata null, vazio e lista vazia como sem valor', () => {
    expect(isEmptyFieldValue(null)).toBe(true);
    expect(isEmptyFieldValue('')).toBe(true);
    expect(isEmptyFieldValue([])).toBe(true);
    expect(isEmptyFieldValue(0)).toBe(false);
    expect(isEmptyFieldValue(false)).toBe(false);
  });
});

describe('formatFieldValue', () => {
  it('mostra a opção pelo nome', () => {
    expect(formatFieldValue(dropdown, 'o2')).toBe('Melhoria');
  });

  it('junta as etiquetas escolhidas', () => {
    const labels = field('f2', 'labels', { options: dropdown.config.options });

    expect(formatFieldValue(labels, ['o1', 'o2'])).toBe('Bug, Melhoria');
  });

  it('formata moeda e número em pt-BR', () => {
    const money = field('f3', 'currency', { currency: 'BRL', precision: 2 });
    const number = field('f4', 'number', { precision: 1 });

    // O Intl separa o símbolo com espaço fino; a asserção normaliza o espaço.
    expect(formatFieldValue(money, 1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50');
    expect(formatFieldValue(number, 1234.56)).toBe('1.234,6');
  });

  it('mostra avaliação, progresso e caixa de seleção', () => {
    expect(formatFieldValue(field('f5', 'rating'), 4)).toBe('4/5');
    expect(formatFieldValue(field('f6', 'progress'), 30)).toBe('30%');
    expect(formatFieldValue(field('f7', 'checkbox'), true)).toBe('Sim');
  });

  it('resolve nome de pessoa pelo resolvedor', () => {
    const people = field('f8', 'people');

    expect(formatFieldValue(people, ['u1'], { nameOf: () => 'Ana' })).toBe('Ana');
  });

  it('mostra a localização com o endereço', () => {
    const place = field('f9', 'location');

    expect(formatFieldValue(place, { lat: -23.5, lng: -46.6, address: 'Centro' })).toBe(
      'Centro (-23.50000, -46.60000)',
    );
  });

  it('devolve texto vazio quando não há valor', () => {
    expect(formatFieldValue(dropdown, null)).toBe('');
  });
});

describe('parseFieldInput', () => {
  it('lê número em pt-BR', () => {
    expect(parseFieldInput(field('f1', 'number'), '1.234,5')).toBe(1234.5);
  });

  it('segura avaliação e progresso nos limites', () => {
    expect(parseFieldInput(field('f1', 'rating'), '9')).toBe(5);
    expect(parseFieldInput(field('f1', 'progress'), '-3')).toBe(0);
  });

  it('transforma o dia do input em instante do meio-dia', () => {
    const value = parseFieldInput(field('f1', 'date'), '2026-03-04');

    expect(typeof value).toBe('string');
    expect(fieldInputText(field('f1', 'date'), value)).toBe('2026-03-04');
  });

  it('texto vazio limpa o campo', () => {
    expect(parseFieldInput(field('f1', 'text'), '   ')).toBeNull();
  });
});

describe('valores da tarefa', () => {
  const values: TaskFieldValue[] = [{ fieldId: 'f1', value: 'o1' }];

  it('acha o valor do campo', () => {
    expect(fieldValueOf(values, 'f1')).toBe('o1');
    expect(fieldValueOf(values, 'f2')).toBeNull();
  });

  it('troca o valor sem duplicar o campo', () => {
    const next = withFieldValue(values, 'f1', 'o2');

    expect(next).toHaveLength(1);
    expect(fieldValueOf(next, 'f1')).toBe('o2');
  });
});

describe('fieldFilterOps', () => {
  it('oferece igualdade para opção e contém para texto', () => {
    expect(fieldFilterOps('dropdown')).toEqual(['eq', 'isEmpty']);
    expect(fieldFilterOps('text')).toEqual(['contains', 'isEmpty']);
    expect(fieldFilterOps('number')).toEqual(['eq', 'gt', 'lt', 'isEmpty']);
    expect(fieldFilterOps('date')).toEqual(['gt', 'lt', 'isEmpty']);
    expect(fieldFilterOps('people')).toEqual(['isEmpty']);
  });
});

describe('colunas de campo', () => {
  it('a fórmula é só leitura', () => {
    expect(isReadOnlyField('formula')).toBe(true);
    expect(isReadOnlyField('text')).toBe(false);
  });

  it('traduz id em chave de coluna e volta', () => {
    expect(fieldColumnKey('f1')).toBe('field:f1');
    expect(fieldIdOfColumn('field:f1')).toBe('f1');
    expect(fieldIdOfColumn('name')).toBeNull();
  });

  it('liga e desliga a coluna do campo', () => {
    const on = toggleFieldColumn({}, 'f1');

    expect(isFieldColumnVisible(on, 'f1')).toBe(true);
    expect(isFieldColumnVisible(toggleFieldColumn(on, 'f1'), 'f1')).toBe(false);
  });

  it('não passa do teto de colunas', () => {
    let config: ViewConfig = {};

    for (const id of ['f1', 'f2', 'f3', 'f4']) {
      config = toggleFieldColumn(config, id);
    }

    expect(config.columns).toHaveLength(3);
    expect(isFieldColumnVisible(config, 'f4')).toBe(false);
  });

  it('devolve os campos das colunas na ordem da config', () => {
    const fields = [field('f1', 'text'), field('f2', 'number')];
    const config: ViewConfig = {
      columns: [{ key: 'field:f2' }, { key: 'name' }, { key: 'field:f1' }],
    };

    expect(fieldColumnsOf(config, fields).map((item) => item.id)).toEqual(['f2', 'f1']);
  });

  it('ignora coluna de campo que já não existe', () => {
    const config: ViewConfig = { columns: [{ key: 'field:removido' }] };

    expect(fieldColumnsOf(config, [])).toEqual([]);
  });
});
