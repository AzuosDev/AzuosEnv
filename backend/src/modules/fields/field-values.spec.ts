import { CustomFieldType } from './custom-field-types';
import { FieldFilter, fieldSortKey, matchesFieldFilter, normalizeFieldValue } from './field-values';
import { CustomField } from './schemas/custom-field.schema';

function field(type: CustomFieldType, config: Record<string, unknown> = {}): CustomField {
  return { name: 'Campo', type, config, required: false } as unknown as CustomField;
}

describe('normalizeFieldValue', () => {
  it('valida número, moeda, rating e progresso', () => {
    expect(normalizeFieldValue(field('number'), '12.345')).toBe(12.35);
    expect(normalizeFieldValue(field('currency', { precision: 2 }), 1200.5)).toBe(1200.5);
    expect(normalizeFieldValue(field('rating'), 4)).toBe(4);
    expect(() => normalizeFieldValue(field('rating'), 9)).toThrow();
    expect(() => normalizeFieldValue(field('progress'), 120)).toThrow();
    expect(() => normalizeFieldValue(field('number'), 'abc')).toThrow();
  });

  it('valida texto, e-mail, url e telefone', () => {
    expect(normalizeFieldValue(field('text'), '  AZD  ')).toBe('AZD');
    expect(normalizeFieldValue(field('email'), 'dev@azuos.dev')).toBe('dev@azuos.dev');
    expect(() => normalizeFieldValue(field('email'), 'azuos')).toThrow();
    expect(normalizeFieldValue(field('url'), 'https://azuos.dev')).toBe('https://azuos.dev');
    expect(() => normalizeFieldValue(field('url'), 'azuos.dev')).toThrow();
    expect(() => normalizeFieldValue(field('phone'), 'oito')).toThrow();
  });

  it('valida opções de dropdown e labels', () => {
    const options = { options: [{ id: 'bug', name: 'Bug' }] };

    expect(normalizeFieldValue(field('dropdown', options), 'bug')).toBe('bug');
    expect(normalizeFieldValue(field('labels', options), ['bug'])).toEqual(['bug']);
    expect(() => normalizeFieldValue(field('dropdown', options), 'feature')).toThrow();
    expect(() => normalizeFieldValue(field('labels', options), 'bug')).toThrow();
  });

  it('valida checkbox, data e localização', () => {
    expect(normalizeFieldValue(field('checkbox'), true)).toBe(true);
    expect(() => normalizeFieldValue(field('checkbox'), 'true')).toThrow();
    expect(normalizeFieldValue(field('date'), '2026-03-01T12:00:00.000Z')).toEqual(
      new Date('2026-03-01T12:00:00.000Z'),
    );
    expect(() => normalizeFieldValue(field('date'), 'ontem')).toThrow();
    expect(normalizeFieldValue(field('location'), { lat: -3.7, lng: -38.5 })).toEqual({
      lat: -3.7,
      lng: -38.5,
    });
    expect(() => normalizeFieldValue(field('location'), { lat: 200, lng: 0 })).toThrow();
  });

  it('esvazia o valor e recusa fórmula', () => {
    expect(normalizeFieldValue(field('text'), null)).toBeNull();
    expect(normalizeFieldValue(field('labels'), [])).toBeNull();
    expect(() => normalizeFieldValue(field('formula'), 10)).toThrow();
  });
});

describe('matchesFieldFilter', () => {
  const filter = (op: FieldFilter['op'], value?: unknown): FieldFilter => ({
    fieldId: 'f',
    op,
    value,
  });

  it('compara eq, contains, gt e lt', () => {
    expect(matchesFieldFilter('bug', filter('eq', 'bug'))).toBe(true);
    expect(matchesFieldFilter(['bug', 'ux'], filter('eq', 'ux'))).toBe(true);
    expect(matchesFieldFilter('Deploy v3.2', filter('contains', 'deploy'))).toBe(true);
    expect(matchesFieldFilter(1200, filter('gt', 1000))).toBe(true);
    expect(matchesFieldFilter(1200, filter('lt', 1000))).toBe(false);
    expect(matchesFieldFilter(true, filter('eq', 'true'))).toBe(true);
  });

  it('trata vazio', () => {
    expect(matchesFieldFilter(null, filter('isEmpty'))).toBe(true);
    expect(matchesFieldFilter(null, filter('isEmpty', false))).toBe(false);
    expect(matchesFieldFilter(null, filter('eq', 'bug'))).toBe(false);
  });
});

describe('fieldSortKey', () => {
  it('ordena números e deixa o vazio no fim', () => {
    expect(fieldSortKey(2) < fieldSortKey(10)).toBe(true);
    expect(fieldSortKey(-5) < fieldSortKey(0)).toBe(true);
    expect(fieldSortKey(10) < fieldSortKey(null)).toBe(true);
    expect(fieldSortKey('azuos') < fieldSortKey('bug')).toBe(true);
  });
});
