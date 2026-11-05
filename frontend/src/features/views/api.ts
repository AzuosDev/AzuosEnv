import { queryOptions } from '@tanstack/react-query';
import { api } from '@/api/client';
import { unwrap } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type {
  CreateViewInput,
  ReorderInput,
  UpdateViewInput,
  View,
  ViewLocationType,
} from '@/api/types';

/** Views salvas do local, na ordem manual. */
export function viewsQuery(wsId: string, locationType: ViewLocationType, locationId: string) {
  return queryOptions({
    queryKey: queryKeys.views(wsId, locationType, locationId),
    queryFn: async (): Promise<View[]> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/views', {
          params: { path: { wsId }, query: { locationType, locationId, limit: 100 } },
        }),
      ).items as View[],
    staleTime: 30_000,
  });
}

export async function createView(wsId: string, body: CreateViewInput): Promise<View> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/views', { params: { path: { wsId } }, body }),
  ) as View;
}

export async function updateView(
  wsId: string,
  viewId: string,
  body: UpdateViewInput,
): Promise<View> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/views/{viewId}', {
      params: { path: { wsId, viewId } },
      body,
    }),
  ) as View;
}

export async function duplicateView(wsId: string, viewId: string): Promise<View> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/views/{viewId}/duplicate', {
      params: { path: { wsId, viewId } },
    }),
  ) as View;
}

export async function reorderView(wsId: string, viewId: string, body: ReorderInput): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/views/{viewId}/reorder', {
      params: { path: { wsId, viewId } },
      body,
    }),
  );
}

export async function deleteView(wsId: string, viewId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/views/{viewId}', {
      params: { path: { wsId, viewId } },
    }),
  );
}
