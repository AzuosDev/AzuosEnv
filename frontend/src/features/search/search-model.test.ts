import { describe, expect, it } from 'vitest';
import type { SearchResult } from '@/api/types';
import { countResults, searchGroups } from './search-model';

const result = {
  q: 'pdv',
  types: ['task', 'list', 'user'],
  results: {
    user: [{ type: 'user', id: 'u1', name: 'Felipe', email: 'felipe@azuos.dev', avatarUrl: null }],
    task: [
      {
        type: 'task',
        id: 't1',
        name: 'Subir o PDV',
        customId: 'AZD-142',
        listId: 'l1',
        statusGroup: 'active',
        priority: 'high',
        dueAt: null,
      },
    ],
    list: [{ type: 'list', id: 'l1', name: 'Entrega', spaceId: 's1', folderId: null }],
  },
} as unknown as SearchResult;

describe('searchGroups', () => {
  it('ordena os grupos e deixa fora o tipo sem resultado', () => {
    expect(searchGroups('w1', result).map((group) => group.type)).toEqual(['task', 'list', 'user']);
  });

  it('manda a tarefa para a rota do painel pelo customId', () => {
    const task = searchGroups('w1', result)[0]?.rows[0];

    expect(task?.hint).toBe('AZD-142');
    expect(task?.target).toEqual({
      to: '/w/$wsId/t/$customId',
      params: { wsId: 'w1', customId: 'AZD-142' },
    });
  });

  it('deixa a pessoa sem rota, porque não há tela de perfil', () => {
    const groups = searchGroups('w1', result);
    const user = groups[groups.length - 1]?.rows[0];

    expect(user?.hint).toBe('felipe@azuos.dev');
    expect(user?.target).toBeNull();
  });

  it('devolve vazio sem resultado', () => {
    expect(searchGroups('w1', undefined)).toEqual([]);
  });
});

describe('countResults', () => {
  it('soma as linhas de todos os grupos', () => {
    expect(countResults(searchGroups('w1', result))).toBe(3);
    expect(countResults([])).toBe(0);
  });
});
