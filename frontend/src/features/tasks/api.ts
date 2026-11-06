import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { api } from '@/api/client';
import { unwrap } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { paths } from '@/api/schema';
import type {
  BulkChanges,
  BulkResult,
  CreateTagInput,
  CreateTaskInput,
  EffectiveStatuses,
  MoveTaskInput,
  Tag,
  Task,
  TaskDetail,
  TaskQueryParams,
  TaskQueryResult,
  UpdateTaskInput,
} from '@/api/types';

/** Query de GET /tasks/query como o cliente gerado a declara. */
type GeneratedTaskQuery = NonNullable<
  paths['/api/v1/workspaces/{wsId}/tasks/query']['get']['parameters']['query']
>;

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
  const { fieldFilters, ...rest } = params;
  const query = {
    ...rest,
    ...(cursor ? { cursor } : {}),
    // O contrato pede o filtro de campo como JSON na query string.
    ...(fieldFilters && fieldFilters.length > 0
      ? { fieldFilters: JSON.stringify(fieldFilters) }
      : {}),
  };

  return unwrap(
    await api.GET('/api/v1/workspaces/{wsId}/tasks/query', {
      params: { path: { wsId }, query: query as GeneratedTaskQuery },
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
      ) as TaskDetail,
    staleTime: 15_000,
  });
}

/** Subtarefas diretas, em ordem manual. Uma página de 100 cobre o painel. */
export function subtasksQuery(wsId: string, idOrCustomId: string) {
  return queryOptions({
    queryKey: queryKeys.subtasks(wsId, idOrCustomId),
    queryFn: async (): Promise<Task[]> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/tasks/{idOrCustomId}/subtasks', {
          params: { path: { wsId, idOrCustomId }, query: { limit: 100 } },
        }),
      ).items as Task[],
    staleTime: 15_000,
  });
}

export async function archiveTask(wsId: string, idOrCustomId: string): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/tasks/{idOrCustomId}/archive', {
      params: { path: { wsId, idOrCustomId } },
    }),
  );
}

export async function unarchiveTask(wsId: string, idOrCustomId: string): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/tasks/{idOrCustomId}/unarchive', {
      params: { path: { wsId, idOrCustomId } },
    }),
  );
}

/** Adiciona a tarefa a outra List, sem trocar a principal. */
export async function addTaskToList(
  wsId: string,
  idOrCustomId: string,
  listId: string,
): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/tasks/{idOrCustomId}/lists', {
      params: { path: { wsId, idOrCustomId } },
      body: { listId },
    }),
  );
}

export async function removeTaskFromList(
  wsId: string,
  idOrCustomId: string,
  listId: string,
): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/tasks/{idOrCustomId}/lists/{listId}', {
      params: { path: { wsId, idOrCustomId, listId } },
    }),
  );
}

/** Cria a tag no Space da tarefa; é o caminho de "criar na hora". */
export async function createTag(wsId: string, body: CreateTagInput): Promise<Tag> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/tags', { params: { path: { wsId } }, body }),
  ) as Tag;
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
