import { queryOptions } from '@tanstack/react-query';
import { api } from '@/api/client';
import { unwrap } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { CreateFavoriteInput, FavoriteItem, RecentItem, ReorderInput } from '@/api/types';

/** Favoritos do usuário no workspace, na ordem manual. */
export function favoritesQuery(wsId: string) {
  return queryOptions({
    queryKey: queryKeys.favorites(wsId),
    queryFn: async (): Promise<FavoriteItem[]> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/favorites', {
          params: { path: { wsId }, query: { limit: 100 } },
        }),
      ).items,
    staleTime: 30_000,
  });
}

/** Últimas tarefas, Lists e Docs abertas pelo usuário. */
export function recentQuery(wsId: string) {
  return queryOptions({
    queryKey: queryKeys.recent(wsId),
    queryFn: async (): Promise<RecentItem[]> =>
      unwrap(await api.GET('/api/v1/workspaces/{wsId}/me/recent', { params: { path: { wsId } } }))
        .items,
    staleTime: 30_000,
  });
}

export async function addFavorite(wsId: string, body: CreateFavoriteInput): Promise<FavoriteItem> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/favorites', { params: { path: { wsId } }, body }),
  );
}

export async function removeFavorite(wsId: string, favoriteId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/favorites/{favoriteId}', {
      params: { path: { wsId, favoriteId } },
    }),
  );
}

export async function reorderFavorite(
  wsId: string,
  favoriteId: string,
  body: ReorderInput,
): Promise<FavoriteItem> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/favorites/{favoriteId}/reorder', {
      params: { path: { wsId, favoriteId } },
      body,
    }),
  );
}
