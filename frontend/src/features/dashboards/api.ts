import { queryOptions } from '@tanstack/react-query';
import { api } from '@/api/client';
import { ApiRequestError, unwrap } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type {
  CardConfig,
  CardDataResponse,
  CreateDashboardInput,
  Dashboard,
  UpdateDashboardInput,
} from '@/api/types';

/** Dashboards visíveis do workspace (os privados de outros ficam fora). */
export function dashboardsQuery(wsId: string) {
  return queryOptions({
    queryKey: queryKeys.dashboards(wsId),
    queryFn: async (): Promise<Dashboard[]> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/dashboards', {
          params: { path: { wsId }, query: { limit: 100 } },
        }),
      ).items as Dashboard[],
    staleTime: 30_000,
  });
}

export function dashboardQuery(wsId: string, dashboardId: string) {
  return queryOptions({
    queryKey: queryKeys.dashboard(wsId, dashboardId),
    queryFn: async (): Promise<Dashboard> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/dashboards/{dashboardId}', {
          params: { path: { wsId, dashboardId } },
        }),
      ) as Dashboard,
    staleTime: 30_000,
  });
}

export async function createDashboard(
  wsId: string,
  body: CreateDashboardInput,
): Promise<Dashboard> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/dashboards', { params: { path: { wsId } }, body }),
  ) as Dashboard;
}

export async function updateDashboard(
  wsId: string,
  dashboardId: string,
  body: UpdateDashboardInput,
): Promise<Dashboard> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/dashboards/{dashboardId}', {
      params: { path: { wsId, dashboardId } },
      body,
    }),
  ) as Dashboard;
}

export async function deleteDashboard(wsId: string, dashboardId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/dashboards/{dashboardId}', {
      params: { path: { wsId, dashboardId } },
    }),
  );
}

/** Dados agregados de um card; o config enviado sobrepõe o salvo. */
export function cardDataQuery(
  wsId: string,
  dashboardId: string,
  cardId: string,
  config: CardConfig,
  enabled = true,
) {
  return queryOptions({
    queryKey: queryKeys.cardData(wsId, dashboardId, cardId, config),
    queryFn: async (): Promise<CardDataResponse> =>
      unwrap(
        await api.POST('/api/v1/workspaces/{wsId}/dashboards/{dashboardId}/cards/{cardId}/data', {
          params: { path: { wsId, dashboardId, cardId } },
          body: { config },
        }),
      ) as CardDataResponse,
    enabled,
    staleTime: 30_000,
  });
}

/** CSV do card já autenticado. */
export async function exportCardCsv(
  wsId: string,
  dashboardId: string,
  cardId: string,
): Promise<Blob> {
  const { data, response } = await api.GET(
    '/api/v1/workspaces/{wsId}/dashboards/{dashboardId}/cards/{cardId}/export',
    { params: { path: { wsId, dashboardId, cardId } }, parseAs: 'blob' },
  );
  const blob = data as unknown;

  if (!response.ok || !(blob instanceof Blob)) {
    throw new ApiRequestError({
      statusCode: response.status,
      code: 'EXPORT_FAILED',
      message: 'Não foi possível exportar o card.',
    });
  }

  return blob;
}
