import type { FavoriteEntityType, FavoriteItem, RecentItem, ReorderInput } from '@/api/types';
import { entityLink, type EntityLink } from '@/lib/entity-links';

export const FAVORITE_LABEL: Record<FavoriteEntityType, string> = {
  space: 'Space',
  folder: 'Folder',
  list: 'List',
  task: 'Tarefa',
  doc: 'Doc',
};

/** Para onde o favorito aponta; Doc ainda não tem tela e devolve null. */
export function favoriteTarget(
  wsId: string,
  entityType: FavoriteEntityType,
  entityId: string,
  customId?: string,
): EntityLink | null {
  return entityLink(wsId, entityType, entityId, customId);
}

/** Só os favoritos cuja entidade o usuário ainda alcança. */
export function visibleFavorites(items: FavoriteItem[] | undefined): FavoriteItem[] {
  return (items ?? []).filter((item) => item.entity !== null);
}

/** Favorito da entidade, se ela já estiver na lista. */
export function favoriteOf(
  items: FavoriteItem[] | undefined,
  entityType: FavoriteEntityType,
  entityId: string,
): FavoriteItem | null {
  return (
    (items ?? []).find((item) => item.entityType === entityType && item.entityId === entityId) ??
    null
  );
}

export interface ReorderPlan extends ReorderInput {
  /** Lista já na ordem nova, para pintar o cache antes da resposta. */
  items: FavoriteItem[];
}

/**
 * Traduz "arrastei A para a posição de B" nos irmãos que cercam A no fim. O
 * cálculo é sobre a lista já reordenada, por isso ele devolve as duas coisas.
 */
export function planFavoriteReorder(
  items: FavoriteItem[],
  activeId: string,
  overId: string,
): ReorderPlan | null {
  const from = items.findIndex((item) => item.id === activeId);
  const to = items.findIndex((item) => item.id === overId);

  if (from === -1 || to === -1 || from === to) {
    return null;
  }

  const next = [...items];
  const [moved] = next.splice(from, 1);

  if (!moved) {
    return null;
  }

  next.splice(to, 0, moved);

  const index = next.findIndex((item) => item.id === activeId);
  const previous = next[index - 1];
  const after = next[index + 1];

  return {
    items: next,
    ...(previous ? { previousId: previous.id } : {}),
    ...(after ? { nextId: after.id } : {}),
  };
}

/** Recentes mais novos primeiro, sem o que já está favoritado. */
export function recentsToShow(
  recents: RecentItem[] | undefined,
  favorites: FavoriteItem[] | undefined,
  max = 5,
): RecentItem[] {
  const pinned = new Set(
    visibleFavorites(favorites).map((item) => `${item.entityType}:${item.entityId}`),
  );

  return (recents ?? [])
    .filter((item) => !pinned.has(`${item.entityType}:${item.entityId}`))
    .slice(0, max);
}
