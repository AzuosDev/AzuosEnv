import { queryOptions } from '@tanstack/react-query';
import { api } from '@/api/client';
import { unwrap } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type {
  CreateGoalFolderInput,
  CreateGoalInput,
  CreateTargetInput,
  Goal,
  GoalFolder,
  GoalView,
  TargetResult,
  UpdateGoalFolderInput,
  UpdateGoalInput,
  UpdateTargetInput,
} from '@/api/types';

/** Metas e pastas lidas de uma vez: a tela mostra tudo em cartões. */
const PAGE_SIZE = 100;

export function goalFoldersQuery(wsId: string) {
  return queryOptions({
    queryKey: queryKeys.goalFolders(wsId),
    queryFn: async (): Promise<GoalFolder[]> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/goal-folders', {
          params: { path: { wsId }, query: { limit: PAGE_SIZE } },
        }),
      ).items as GoalFolder[],
    staleTime: 30_000,
  });
}

export interface GoalsFilter {
  folderId?: string;
  mine?: boolean;
}

export function goalsQuery(wsId: string, filter: GoalsFilter = {}) {
  return queryOptions({
    queryKey: queryKeys.goals(wsId, { ...filter }),
    queryFn: async (): Promise<GoalView[]> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/goals', {
          params: {
            path: { wsId },
            query: {
              limit: PAGE_SIZE,
              ...(filter.folderId ? { folderId: filter.folderId } : {}),
              ...(filter.mine ? { mine: true } : {}),
            },
          },
        }),
      ).items as GoalView[],
    staleTime: 30_000,
  });
}

export function goalQuery(wsId: string, goalId: string) {
  return queryOptions({
    queryKey: queryKeys.goal(wsId, goalId),
    queryFn: async (): Promise<GoalView> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/goals/{goalId}', {
          params: { path: { wsId, goalId } },
        }),
      ) as GoalView,
    staleTime: 15_000,
  });
}

export async function createGoalFolder(
  wsId: string,
  body: CreateGoalFolderInput,
): Promise<GoalFolder> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/goal-folders', { params: { path: { wsId } }, body }),
  ) as GoalFolder;
}

export async function updateGoalFolder(
  wsId: string,
  folderId: string,
  body: UpdateGoalFolderInput,
): Promise<GoalFolder> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/goal-folders/{folderId}', {
      params: { path: { wsId, folderId } },
      body,
    }),
  ) as GoalFolder;
}

export async function deleteGoalFolder(wsId: string, folderId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/goal-folders/{folderId}', {
      params: { path: { wsId, folderId } },
    }),
  );
}

export async function createGoal(wsId: string, body: CreateGoalInput): Promise<Goal> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/goals', { params: { path: { wsId } }, body }),
  ) as Goal;
}

export async function updateGoal(
  wsId: string,
  goalId: string,
  body: UpdateGoalInput,
): Promise<GoalView> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/goals/{goalId}', {
      params: { path: { wsId, goalId } },
      body,
    }),
  ) as GoalView;
}

export async function deleteGoal(wsId: string, goalId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/goals/{goalId}', {
      params: { path: { wsId, goalId } },
    }),
  );
}

export async function createTarget(
  wsId: string,
  goalId: string,
  body: CreateTargetInput,
): Promise<TargetResult> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/goals/{goalId}/targets', {
      params: { path: { wsId, goalId } },
      body,
    }),
  ) as TargetResult;
}

export async function updateTarget(
  wsId: string,
  goalId: string,
  targetId: string,
  body: UpdateTargetInput,
): Promise<TargetResult> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/goals/{goalId}/targets/{targetId}', {
      params: { path: { wsId, goalId, targetId } },
      body,
    }),
  ) as TargetResult;
}

export async function deleteTarget(wsId: string, goalId: string, targetId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/goals/{goalId}/targets/{targetId}', {
      params: { path: { wsId, goalId, targetId } },
    }),
  );
}
