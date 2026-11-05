import { describe, expect, it } from 'vitest';
import type { ViewConfig } from '@/api/types';
import {
  activeFilterCount,
  clearFilters,
  dayToIso,
  isoToDay,
  toQueryParams,
  toggleValue,
} from './filters';

const context = { location: 'list', locationId: 'L1', groupBy: 'status' } as const;

describe('toQueryParams', () => {
  it('manda só o essencial quando a view não tem filtro', () => {
    expect(toQueryParams({}, context)).toEqual({
      location: 'list',
      locationId: 'L1',
      groupBy: 'status',
      sortBy: 'position',
      limit: 50,
    });
  });

  it('leva cada filtro da config para o parâmetro da API', () => {
    const config: ViewConfig = {
      filters: {
        statusIds: ['s1', 's2'],
        assigneeIds: ['u1'],
        priority: ['urgent', 'high'],
        tagIds: ['t1'],
        me: true,
        dueFrom: '2026-11-01T00:00:00.000Z',
        dueTo: '2026-11-30T23:59:59.000Z',
      },
      sortBy: 'dueAt',
      showSubtasks: true,
      showClosed: true,
    };

    expect(toQueryParams(config, { ...context, groupBy: 'assignee' })).toEqual({
      location: 'list',
      locationId: 'L1',
      groupBy: 'assignee',
      sortBy: 'dueAt',
      limit: 50,
      statusIds: ['s1', 's2'],
      assigneeIds: ['u1'],
      priority: ['urgent', 'high'],
      tagIds: ['t1'],
      me: true,
      dueFrom: '2026-11-01T00:00:00.000Z',
      dueTo: '2026-11-30T23:59:59.000Z',
      includeSubtasks: true,
      includeClosed: true,
    });
  });

  it('descarta lista vazia, false e busca em branco', () => {
    const config: ViewConfig = {
      filters: { statusIds: [], priority: [], me: false },
      showSubtasks: false,
      showClosed: false,
    };

    expect(toQueryParams(config, { ...context, search: '   ' })).toEqual({
      location: 'list',
      locationId: 'L1',
      groupBy: 'status',
      sortBy: 'position',
      limit: 50,
    });
  });

  it('a busca da toolbar vence o q guardado na view', () => {
    const config: ViewConfig = { filters: { q: 'salvo' } };

    expect(toQueryParams(config, context).q).toBe('salvo');
    expect(toQueryParams(config, { ...context, search: ' caixa ' }).q).toBe('caixa');
  });
});

describe('activeFilterCount', () => {
  it('conta cada grupo ligado, cada data e o Eu', () => {
    expect(activeFilterCount(undefined)).toBe(0);
    expect(activeFilterCount({ statusIds: [], q: 'x' })).toBe(0);
    expect(
      activeFilterCount({ statusIds: ['s1'], priority: ['low'], me: true, dueTo: 'iso' }),
    ).toBe(4);
  });
});

describe('toggleValue', () => {
  it('liga e desliga mantendo a ordem', () => {
    expect(toggleValue(undefined, 'a')).toEqual(['a']);
    expect(toggleValue(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleValue(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('clearFilters', () => {
  it('apaga os filtros e preserva a ordem e a busca salva', () => {
    const config: ViewConfig = {
      filters: { statusIds: ['s1'], q: 'salvo' },
      sortBy: 'name',
      showClosed: true,
    };

    expect(clearFilters(config)).toEqual({
      filters: { q: 'salvo' },
      sortBy: 'name',
      showClosed: true,
    });
    expect(clearFilters({ filters: { me: true } })).toEqual({ filters: {} });
  });
});

describe('datas do filtro', () => {
  it('vai e volta entre o dia do input e o instante', () => {
    const iso = dayToIso('2026-11-05', 'start');

    expect(iso).toBeDefined();
    expect(isoToDay(iso)).toBe('2026-11-05');
    expect(dayToIso('05/11/2026', 'start')).toBeUndefined();
    expect(isoToDay(undefined)).toBe('');
  });
});
