import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { api } from '@/api/client';
import { ApiRequestError, unwrap } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type {
  Activity,
  TaskDependency,
  TaskLocation,
  WorkloadMetric,
  WorkloadResult,
} from '@/api/types';

/** Quantas linhas o feed da Activity traz por lote. */
export const ACTIVITY_PAGE_SIZE = 30;

export interface WorkloadParams {
  /** Primeiro dia do recorte (yyyy-MM-dd). */
  from: string;
  to: string;
  metric: WorkloadMetric;
  location: TaskLocation;
  locationId: string;
}

/** Valor por pessoa e dia, com a capacidade de cada membro. */
export function workloadQuery(wsId: string, params: WorkloadParams) {
  return queryOptions({
    queryKey: queryKeys.workload(wsId, { ...params }),
    queryFn: async (): Promise<WorkloadResult> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/workload', {
          params: { path: { wsId }, query: params },
        }),
      ),
    staleTime: 30_000,
  });
}

export interface ActivityParams {
  location: TaskLocation;
  locationId: string;
}

interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** Feed do local, do mais recente para o mais antigo, por cursor. */
export function locationActivityQuery(wsId: string, params: ActivityParams) {
  return infiniteQueryOptions({
    queryKey: queryKeys.activityFeed(wsId, { ...params }),
    queryFn: async ({ pageParam }): Promise<Page<Activity>> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/activity', {
          params: {
            path: { wsId },
            query: {
              ...params,
              limit: ACTIVITY_PAGE_SIZE,
              ...(pageParam ? { cursor: pageParam } : {}),
            },
          },
        }),
      ) as Page<Activity>,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

/**
 * Dependências entre as tarefas que estão na tela, para o Gantt desenhar as
 * setas sem uma chamada por tarefa.
 */
export function taskDependenciesQuery(wsId: string, taskIds: string[]) {
  const ids = [...taskIds].sort((left, right) => left.localeCompare(right));

  return queryOptions({
    queryKey: queryKeys.taskDependencies(wsId, ids),
    queryFn: async (): Promise<TaskDependency[]> =>
      ids.length === 0
        ? []
        : (unwrap(
            await api.GET('/api/v1/workspaces/{wsId}/dependencies', {
              params: { path: { wsId }, query: { taskIds: ids.join(',') } },
            }),
          ) as TaskDependency[]),
    staleTime: 30_000,
  });
}

export type ExportFormat = 'csv' | 'xlsx';

export interface ExportedFile {
  blob: Blob;
  filename: string;
}

/**
 * Tarefas da view em CSV ou Excel. O download direto pela URL não funcionaria:
 * o access token vive só em memória, não em cookie.
 */
export async function exportView(
  wsId: string,
  viewId: string,
  format: ExportFormat,
): Promise<ExportedFile> {
  const { data, response } = await api.GET('/api/v1/workspaces/{wsId}/views/{viewId}/export', {
    params: { path: { wsId, viewId }, query: { format } },
    parseAs: 'blob',
  });

  if (!response.ok || !data) {
    throw new ApiRequestError({
      statusCode: response.status,
      code: 'EXPORT_FAILED',
      message: 'Não foi possível exportar a view.',
    });
  }

  const disposition = response.headers.get('content-disposition') ?? '';
  const match = /filename="?([^";]+)"?/.exec(disposition);

  return { blob: data as Blob, filename: match?.[1] ?? `view.${format}` };
}
