import { queryOptions, useQueries } from '@tanstack/react-query';
import { api } from '@/api/client';
import { unwrap } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type {
  CloseSprintResult,
  CreateSprintFolderInput,
  CreateSprintInput,
  ListNode,
  SprintFolder,
  SprintFolderView,
  UpdateSprintFolderInput,
} from '@/api/types';

const PAGE_SIZE = 50;

export function sprintFoldersQuery(wsId: string) {
  return queryOptions({
    queryKey: queryKeys.sprintFolders(wsId),
    queryFn: async (): Promise<SprintFolder[]> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/sprint-folders', {
          params: { path: { wsId }, query: { limit: PAGE_SIZE } },
        }),
      ).items as SprintFolder[],
    staleTime: 60_000,
  });
}

/** Pasta de sprints com as sprints (Lists) em ordem de início. */
export function sprintFolderQuery(wsId: string, sprintFolderId: string) {
  return queryOptions({
    queryKey: queryKeys.sprintFolder(wsId, sprintFolderId),
    queryFn: async (): Promise<SprintFolderView> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/sprint-folders/{sprintFolderId}', {
          params: { path: { wsId, sprintFolderId } },
        }),
      ) as SprintFolderView,
    staleTime: 60_000,
  });
}

/**
 * Todas as pastas com as sprints delas. São poucas pastas por workspace, então
 * um useQueries resolve e a sidebar sabe qual List é a sprint atual.
 */
export function useSprintFolderViews(wsId: string, folders: SprintFolder[]): SprintFolderView[] {
  const results = useQueries({
    queries: folders.map((folder) => sprintFolderQuery(wsId, folder.id)),
  });

  return results
    .map((result) => result.data)
    .filter((view): view is SprintFolderView => view !== undefined);
}

export async function createSprintFolder(
  wsId: string,
  body: CreateSprintFolderInput,
): Promise<SprintFolderView> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/sprint-folders', {
      params: { path: { wsId } },
      body,
    }),
  ) as SprintFolderView;
}

export async function updateSprintFolder(
  wsId: string,
  sprintFolderId: string,
  body: UpdateSprintFolderInput,
): Promise<SprintFolder> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/sprint-folders/{sprintFolderId}', {
      params: { path: { wsId, sprintFolderId } },
      body,
    }),
  ) as SprintFolder;
}

export async function createSprint(
  wsId: string,
  sprintFolderId: string,
  body: CreateSprintInput = {},
): Promise<ListNode> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/sprint-folders/{sprintFolderId}/sprints', {
      params: { path: { wsId, sprintFolderId } },
      body,
    }),
  ) as ListNode;
}

/** Fecha a sprint; o que não foi entregue vai para a próxima. */
export async function closeSprint(wsId: string, sprintId: string): Promise<CloseSprintResult> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/sprints/{sprintId}/close', {
      params: { path: { wsId, sprintId } },
    }),
  ) as CloseSprintResult;
}
