import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { api } from '@/api/client';
import { unwrap } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type {
  BulkChanges,
  BulkResult,
  CreateTaskInput,
  EffectiveStatuses,
  MoveTaskInput,
  Tag,
  Task,
  TaskQueryParams,
  TaskQueryResult,
  UpdateTaskInput,
} from '@/api/types';

/** Statuses efetivos da List (list > folder > space). */
export function listStatusesQuery(wsId: string, listId: string) {
  return queryOptions({
    queryKey: queryKeys.listStatuses(wsId, listId),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/lists/{listId}/statuses', {
          params: { path: { wsId, listId } },
        }),
      ) as EffectiveStatuses,
    staleTime: 60_000,
  });
}

/** Tags dos Spaces visíveis; com spaceId, só as do Space. */
export function tagsQuery(wsId: string, spaceId?: string) {
  return queryOptions({
    queryKey: queryKeys.tags(wsId, spaceId),
    queryFn: async (): Promise<Tag[]> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/tags', {
          params: { path: { wsId }, query: { limit: 100, ...(spaceId ? { spaceId } : {}) } },
        }),
      ).items as Tag[],
    staleTime: 60_000,
  });
}

/**
 * Consulta das views. Sem cursor a API devolve todos os grupos (ou a primeira
 * página plana); com cursor devolve só a continuação daquele grupo.
 */
export async function queryTasks(
  wsId: string,
  params: TaskQueryParams,
  cursor?: string,
): Promise<TaskQueryResult> {
  return unwrap(
    await api.GET('/api/v1/workspaces/{wsId}/tasks/query', {
      params: { path: { wsId }, query: { ...params, ...(cursor ? { cursor } : {}) } },
    }),
  ) as TaskQueryResult;
}

/**
 * Páginas da consulta. A primeira traz tudo; cada `fetchNextPage` manda o cursor
 * escolhido por `nextCursor` (o grupo pedido vem do chamador).
 */
export function tasksInfiniteQuery(
  wsId: string,
  params: TaskQueryParams,
  nextCursor: () => string | undefined,
) {
  return infiniteQueryOptions({
    queryKey: queryKeys.tasks(wsId, params),
    queryFn: ({ pageParam }) => queryTasks(wsId, params, pageParam ?? undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: () => nextCursor(),
    staleTime: 15_000,
  });
}

export function taskQuery(wsId: string, idOrCustomId: string) {
  return queryOptions({
    queryKey: queryKeys.task(wsId, idOrCustomId),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/tasks/{idOrCustomId}', {
          params: { path: { wsId, idOrCustomId } },
        }),
      ) as Task,
  });
}

export async function createTask(
  wsId: string,
  listId: string,
  body: CreateTaskInput,
): Promise<Task> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/lists/{listId}/tasks', {
      params: { path: { wsId, listId } },
      body,
    }),
  ) as Task;
}

export async function updateTask(
  wsId: string,
  idOrCustomId: string,
  body: UpdateTaskInput,
): Promise<Task> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/tasks/{idOrCustomId}', {
      params: { path: { wsId, idOrCustomId } },
      body,
    }),
  ) as Task;
}

export async function moveTask(
  wsId: string,
  idOrCustomId: string,
  body: MoveTaskInput,
): Promise<Task> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/tasks/{idOrCustomId}/move', {
      params: { path: { wsId, idOrCustomId } },
      body,
    }),
  ) as Task;
}

export async function deleteTask(wsId: string, idOrCustomId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/tasks/{idOrCustomId}', {
      params: { path: { wsId, idOrCustomId } },
    }),
  );
}

export async function bulkTasks(
  wsId: string,
  ids: string[],
  changes: BulkChanges,
): Promise<BulkResult> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/tasks/bulk', {
      params: { path: { wsId } },
      body: { ids, changes },
    }),
  );
}
