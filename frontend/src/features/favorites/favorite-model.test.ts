import { describe, expect, it } from 'vitest';
import type { FavoriteItem, RecentItem } from '@/api/types';
import {
  favoriteOf,
  favoriteTarget,
  planFavoriteReorder,
  recentsToShow,
  visibleFavorites,
} from './favorite-model';

function favorite(id: string, entityId = id, entityType: FavoriteItem['entityType'] = 'list') {
  return {
    id,
    entityType,
    entityId,
    position: id,
    entity: { id: entityId, name: `Nome ${id}` },
  } as FavoriteItem;
}

describe('favoriteTarget', () => {
  it('manda cada tipo para a rota dele', () => {
    expect(favoriteTarget('w1', 'space', 's1')?.to).toBe('/w/$wsId/s/$spaceId');
    expect(favoriteTarget('w1', 'folder', 'f1')?.to).toBe('/w/$wsId/f/$folderId');
    expect(favoriteTarget('w1', 'list', 'l1')).toEqual({
      to: '/w/$wsId/l/$listId',
      params: { wsId: 'w1', listId: 'l1' },
    });
  });

  it('prefere o customId na tarefa e cai no id sem ele', () => {
    expect(favoriteTarget('w1', 'task', 't1', 'AZD-142')).toEqual({
      to: '/w/$wsId/t/$customId',
      params: { wsId: 'w1', customId: 'AZD-142' },
    });
    expect(favoriteTarget('w1', 'task', 't1')).toEqual({
      to: '/w/$wsId/t/$customId',
      params: { wsId: 'w1', customId: 't1' },
    });
  });

  it('não tem rota para Doc ainda', () => {
    expect(favoriteTarget('w1', 'doc', 'd1')).toBeNull();
  });
});

describe('visibleFavorites e favoriteOf', () => {
  it('esconde o favorito sem entidade alcançável', () => {
    const items = [favorite('a'), { ...favorite('b'), entity: null }];

    expect(visibleFavorites(items).map((item) => item.id)).toEqual(['a']);
  });

  it('acha o favorito pela entidade', () => {
    const items = [favorite('a', 'l1'), favorite('b', 't1', 'task')];

    expect(favoriteOf(items, 'task', 't1')?.id).toBe('b');
    expect(favoriteOf(items, 'task', 'l1')).toBeNull();
  });
});

describe('planFavoriteReorder', () => {
  const items = [favorite('a'), favorite('b'), favorite('c')];

  it('leva o primeiro para o fim', () => {
    const plan = planFavoriteReorder(items, 'a', 'c');

    expect(plan?.items.map((item) => item.id)).toEqual(['b', 'c', 'a']);
    expect(plan?.previousId).toBe('c');
    expect(plan?.nextId).toBeUndefined();
  });

  it('leva o último para o começo', () => {
    const plan = planFavoriteReorder(items, 'c', 'a');

    expect(plan?.items.map((item) => item.id)).toEqual(['c', 'a', 'b']);
    expect(plan?.previousId).toBeUndefined();
    expect(plan?.nextId).toBe('a');
  });

  it('ignora soltar no mesmo lugar ou em item que não existe', () => {
    expect(planFavoriteReorder(items, 'a', 'a')).toBeNull();
    expect(planFavoriteReorder(items, 'a', 'z')).toBeNull();
  });
});

describe('recentsToShow', () => {
  const recents = [
    { entityType: 'task', entityId: 't1', openedAt: '', entity: { id: 't1', name: 'T1' } },
    { entityType: 'list', entityId: 'l1', openedAt: '', entity: { id: 'l1', name: 'L1' } },
  ] as RecentItem[];

  it('tira o que já é favorito e corta no máximo', () => {
    const shown = recentsToShow(recents, [favorite('f', 't1', 'task')], 5);

    expect(shown.map((item) => item.entityId)).toEqual(['l1']);
    expect(recentsToShow(recents, [], 1)).toHaveLength(1);
  });
});
