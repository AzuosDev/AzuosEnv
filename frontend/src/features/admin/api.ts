import { queryOptions } from '@tanstack/react-query';
import { API_BASE_URL, api, apiFetch } from '@/api/client';
import { ApiRequestError, unwrap } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type {
  ApiKey,
  AuditLog,
  AuditQuery,
  ClickAppsOverride,
  CreateApiKeyInput,
  CreatedApiKey,
  CreateGithubIntegrationInput,
  CreateOutgoingWebhookInput,
  GithubIntegrationResult,
  GithubIntegrations,
  GoogleCalendar,
  GoogleStatus,
  ImportReport,
  OutgoingWebhook,
  OutgoingWebhookResult,
  Space,
  UpdateGithubIntegrationInput,
  UpdateOutgoingWebhookInput,
  WebhookDelivery,
  WorkspaceExportFile,
} from '@/api/types';

/* ClickApps -------------------------------------------------------------- */

/** ClickApps do Space; o workspace vai pelo updateWorkspace de Configurações. */
export async function updateSpaceClickApps(
  wsId: string,
  spaceId: string,
  clickApps: ClickAppsOverride,
): Promise<Space> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/spaces/{spaceId}', {
      params: { path: { wsId, spaceId } },
      body: { clickApps },
    }),
  ) as Space;
}

/* GitHub ----------------------------------------------------------------- */

export function githubIntegrationsQuery(wsId: string) {
  return queryOptions({
    queryKey: queryKeys.githubIntegrations(wsId),
    queryFn: async (): Promise<GithubIntegrations> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/integrations/github', {
          params: { path: { wsId } },
        }),
      ) as GithubIntegrations,
    staleTime: 30_000,
  });
}

export async function createGithubIntegration(
  wsId: string,
  body: CreateGithubIntegrationInput,
): Promise<GithubIntegrationResult> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/integrations/github', {
      params: { path: { wsId } },
      body,
    }),
  ) as GithubIntegrationResult;
}

export async function updateGithubIntegration(
  wsId: string,
  integrationId: string,
  body: UpdateGithubIntegrationInput,
): Promise<GithubIntegrationResult> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/integrations/github/{integrationId}', {
      params: { path: { wsId, integrationId } },
      body,
    }),
  ) as GithubIntegrationResult;
}

export async function deleteGithubIntegration(wsId: string, integrationId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/integrations/github/{integrationId}', {
      params: { path: { wsId, integrationId } },
    }),
  );
}

/* Google Agenda ---------------------------------------------------------- */

export function googleIntegrationQuery(wsId: string) {
  return queryOptions({
    queryKey: queryKeys.googleIntegration(wsId),
    queryFn: async (): Promise<GoogleStatus> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/integrations/google', {
          params: { path: { wsId } },
        }),
      ),
    staleTime: 30_000,
  });
}

/** Agendas da conta conectada; só faz sentido com a conta já ligada. */
export function googleCalendarsQuery(wsId: string, enabled: boolean) {
  return queryOptions({
    queryKey: queryKeys.googleCalendars(wsId),
    queryFn: async (): Promise<GoogleCalendar[]> => {
      const result = unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/integrations/google/calendars', {
          params: { path: { wsId } },
        }),
      );

      return result.items;
    },
    enabled,
    staleTime: 60_000,
  });
}

export async function googleAuthUrl(wsId: string): Promise<string> {
  const result = unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/integrations/google/auth-url', {
      params: { path: { wsId } },
    }),
  );

  return result.url;
}

export async function chooseGoogleCalendar(
  wsId: string,
  calendarId: string,
): Promise<GoogleStatus> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/integrations/google', {
      params: { path: { wsId } },
      body: { calendarId },
    }),
  );
}

export async function disconnectGoogle(wsId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/integrations/google', {
      params: { path: { wsId } },
    }),
  );
}

/* Webhooks de saída ------------------------------------------------------ */

export function webhooksQuery(wsId: string) {
  return queryOptions({
    queryKey: queryKeys.webhooks(wsId),
    queryFn: async (): Promise<OutgoingWebhook[]> => {
      const result = unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/webhooks', { params: { path: { wsId } } }),
      );

      return result.items as OutgoingWebhook[];
    },
    staleTime: 30_000,
  });
}

export async function createWebhook(
  wsId: string,
  body: CreateOutgoingWebhookInput,
): Promise<OutgoingWebhookResult> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/webhooks', { params: { path: { wsId } }, body }),
  ) as OutgoingWebhookResult;
}

export async function updateWebhook(
  wsId: string,
  webhookId: string,
  body: UpdateOutgoingWebhookInput,
): Promise<OutgoingWebhookResult> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/webhooks/{webhookId}', {
      params: { path: { wsId, webhookId } },
      body,
    }),
  ) as OutgoingWebhookResult;
}

export async function deleteWebhook(wsId: string, webhookId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/webhooks/{webhookId}', {
      params: { path: { wsId, webhookId } },
    }),
  );
}

export function webhookDeliveriesQuery(wsId: string, webhookId: string) {
  return queryOptions({
    queryKey: queryKeys.webhookDeliveries(wsId, webhookId),
    queryFn: async (): Promise<WebhookDelivery[]> => {
      const page = unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/webhooks/{webhookId}/deliveries', {
          params: { path: { wsId, webhookId }, query: { limit: 50 } },
        }),
      );

      return page.items as WebhookDelivery[];
    },
    staleTime: 5_000,
  });
}

/** Reenvia a entrega; o reenvio é uma linha nova do log. */
export async function redeliverWebhook(
  wsId: string,
  webhookId: string,
  deliveryId: string,
): Promise<WebhookDelivery> {
  return unwrap(
    await api.POST(
      '/api/v1/workspaces/{wsId}/webhooks/{webhookId}/deliveries/{deliveryId}/redeliver',
      { params: { path: { wsId, webhookId, deliveryId } } },
    ),
  ) as WebhookDelivery;
}

/* Chaves de API ---------------------------------------------------------- */

export function apiKeysQuery() {
  return queryOptions({
    queryKey: queryKeys.apiKeys(),
    queryFn: async (): Promise<ApiKey[]> => {
      const result = unwrap(await api.GET('/api/v1/users/me/api-keys'));

      return result.items as ApiKey[];
    },
    staleTime: 30_000,
  });
}

export async function createApiKey(body: CreateApiKeyInput): Promise<CreatedApiKey> {
  return unwrap(await api.POST('/api/v1/users/me/api-keys', { body })) as CreatedApiKey;
}

export async function revokeApiKey(apiKeyId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/users/me/api-keys/{apiKeyId}', { params: { path: { apiKeyId } } }),
  );
}

/* Auditoria -------------------------------------------------------------- */

export function auditLogsQuery(wsId: string, query: AuditQuery) {
  return queryOptions({
    queryKey: queryKeys.auditLogs(wsId, query),
    queryFn: async (): Promise<AuditLog[]> => {
      const page = unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/audit-logs', {
          params: { path: { wsId }, query: { ...query, limit: query.limit ?? 50 } },
        }),
      );

      return page.items as AuditLog[];
    },
    staleTime: 10_000,
  });
}

/* Importar e exportar ---------------------------------------------------- */

/**
 * Envia o CSV do ClickUp. Vai por fetch assinado porque o cliente tipado não
 * monta multipart.
 */
export async function importClickUpCsv(
  wsId: string,
  spaceId: string,
  file: File,
): Promise<ImportReport> {
  const form = new FormData();

  form.append('file', file, file.name);
  form.append('spaceId', spaceId);

  const response = await apiFetch(
    new Request(`${API_BASE_URL}/api/v1/workspaces/${wsId}/import/clickup`, {
      method: 'POST',
      body: form,
      credentials: 'include',
    }),
  );

  const body: unknown = await response.json();

  if (!response.ok) {
    const error = body as { statusCode?: number; code?: string; message?: string };

    throw new ApiRequestError({
      statusCode: error.statusCode ?? response.status,
      code: error.code ?? 'HTTP_ERROR',
      message: error.message ?? 'Não foi possível importar o arquivo.',
    });
  }

  return body as ImportReport;
}

export async function exportWorkspace(wsId: string): Promise<WorkspaceExportFile> {
  return unwrap(
    await api.GET('/api/v1/workspaces/{wsId}/export', { params: { path: { wsId } } }),
  ) as WorkspaceExportFile;
}
