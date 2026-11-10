import { queryOptions } from '@tanstack/react-query';
import { api } from '@/api/client';
import { unwrap } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { SearchResult } from '@/api/types';

/** Letras mínimas antes de a busca global sair. */
export const MIN_SEARCH_TERM = 2;

/** Quantos resultados por tipo a palette pede. */
export const SEARCH_LIMIT = 8;

/** Busca global do workspace, já filtrada por permissão pela API. */
export function searchQuery(wsId: string, term: string) {
  return queryOptions({
    queryKey: queryKeys.search(wsId, term),
    queryFn: async (): Promise<SearchResult> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/search', {
          params: { path: { wsId }, query: { q: term, limit: SEARCH_LIMIT } },
        }),
      ),
    enabled: term.length >= MIN_SEARCH_TERM,
    staleTime: 15_000,
  });
}
