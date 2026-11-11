import { queryOptions } from '@tanstack/react-query';
import { api } from '@/api/client';
import { unwrap } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type {
  CreateWhiteboardInput,
  ElementTaskResult,
  Whiteboard,
  WhiteboardLocationType,
} from '@/api/types';
import type { BoardOp } from './elements';

export interface WhiteboardsFilter {
  locationType?: WhiteboardLocationType;
  locationId?: string;
}

/** Quadros visíveis, mais novos primeiro; o hub não pagina além de 100. */
export function whiteboardsQuery(wsId: string, filter: WhiteboardsFilter = {}) {
  return queryOptions({
    queryKey: queryKeys.whiteboards(wsId, filter.locationType, filter.locationId),
    queryFn: async (): Promise<Whiteboard[]> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/whiteboards', {
          params: {
            path: { wsId },
            query: {
              limit: 100,
              locationType: filter.locationType,
              locationId: filter.locationId,
            },
          },
        }),
      ).items as Whiteboard[],
    staleTime: 30_000,
  });
}

export function whiteboardQuery(wsId: string, whiteboardId: string) {
  return queryOptions({
    queryKey: queryKeys.whiteboard(wsId, whiteboardId),
    queryFn: async (): Promise<Whiteboard> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/whiteboards/{whiteboardId}', {
          params: { path: { wsId, whiteboardId } },
        }),
      ) as Whiteboard,
    staleTime: 0,
  });
}

export async function createWhiteboard(
  wsId: string,
  body: CreateWhiteboardInput,
): Promise<Whiteboard> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/whiteboards', { params: { path: { wsId } }, body }),
  ) as Whiteboard;
}

export async function renameWhiteboard(
  wsId: string,
  whiteboardId: string,
  title: string,
): Promise<Whiteboard> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/whiteboards/{whiteboardId}', {
      params: { path: { wsId, whiteboardId } },
      body: { title },
    }),
  ) as Whiteboard;
}

export async function deleteWhiteboard(wsId: string, whiteboardId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/whiteboards/{whiteboardId}', {
      params: { path: { wsId, whiteboardId } },
    }),
  );
}

/** Lote de elementos com a versão carregada; divergência responde 409. */
export async function patchElements(
  wsId: string,
  whiteboardId: string,
  version: number,
  ops: BoardOp[],
): Promise<Whiteboard> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/whiteboards/{whiteboardId}/elements', {
      params: { path: { wsId, whiteboardId } },
      body: { version, ops },
    }),
  ) as Whiteboard;
}

export async function elementToTask(
  wsId: string,
  whiteboardId: string,
  elementId: string,
  listId: string,
): Promise<ElementTaskResult> {
  return unwrap(
    await api.POST(
      '/api/v1/workspaces/{wsId}/whiteboards/{whiteboardId}/elements/{elementId}/to-task',
      {
        params: { path: { wsId, whiteboardId, elementId } },
        body: { listId },
      },
    ),
  ) as ElementTaskResult;
}
