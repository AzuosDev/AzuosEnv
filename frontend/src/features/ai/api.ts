import { queryOptions } from '@tanstack/react-query';
import { api, API_BASE_URL, apiFetch } from '@/api/client';
import { ApiRequestError, unwrap } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type {
  AiAgent,
  AiConfirmResult,
  AiSummarizeInput,
  AiSummary,
  AiTaskProposal,
  AiUsageSummary,
  AiWriteAction,
  AiWriteResult,
  ApiErrorBody,
  CreateAiAgentInput,
  ProposedTask,
  UpdateAiAgentInput,
} from '@/api/types';

export function aiUsageQuery(wsId: string) {
  return queryOptions({
    queryKey: queryKeys.aiUsage(wsId),
    queryFn: async (): Promise<AiUsageSummary> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/ai/usage', { params: { path: { wsId } } }),
      ) as AiUsageSummary,
    staleTime: 60_000,
    retry: false,
  });
}

export function aiAgentsQuery(wsId: string) {
  return queryOptions({
    queryKey: queryKeys.aiAgents(wsId),
    queryFn: async (): Promise<AiAgent[]> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/ai/agents', {
          params: { path: { wsId }, query: { limit: 100 } },
        }),
      ).items as AiAgent[],
    staleTime: 30_000,
    retry: false,
  });
}

export async function summarize(wsId: string, body: AiSummarizeInput): Promise<AiSummary> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/ai/summarize', {
      params: { path: { wsId } },
      body,
    }),
  ) as AiSummary;
}

export async function tasksFromText(
  wsId: string,
  body: { text: string; listId: string },
): Promise<AiTaskProposal> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/ai/tasks-from-text', {
      params: { path: { wsId } },
      body,
    }),
  ) as AiTaskProposal;
}

export async function confirmTasksFromText(
  wsId: string,
  body: { listId: string; tasks: ProposedTask[] },
): Promise<AiConfirmResult> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/ai/tasks-from-text/confirm', {
      params: { path: { wsId } },
      body,
    }),
  ) as AiConfirmResult;
}

export async function writeWithAi(
  wsId: string,
  body: { action: AiWriteAction; text: string },
): Promise<AiWriteResult> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/ai/write', { params: { path: { wsId } }, body }),
  ) as AiWriteResult;
}

export async function createAiAgent(wsId: string, body: CreateAiAgentInput): Promise<AiAgent> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/ai/agents', { params: { path: { wsId } }, body }),
  ) as AiAgent;
}

export async function updateAiAgent(
  wsId: string,
  agentId: string,
  body: UpdateAiAgentInput,
): Promise<AiAgent> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/ai/agents/{agentId}', {
      params: { path: { wsId, agentId } },
      body,
    }),
  ) as AiAgent;
}

export async function deleteAiAgent(wsId: string, agentId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/ai/agents/{agentId}', {
      params: { path: { wsId, agentId } },
    }),
  );
}

/**
 * Abre o stream SSE do chat. O pedido bloqueado (orçamento, limite ou IA
 * desligada) responde JSON antes do primeiro byte, e aí vira ApiRequestError.
 */
export async function openChatStream(
  wsId: string,
  body: { message: string; conversationId?: string },
  signal: AbortSignal,
): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  const response = await apiFetch(
    new Request(`${API_BASE_URL}/api/v1/workspaces/${wsId}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      credentials: 'include',
      signal,
    }),
  );

  if (!response.ok || !response.body) {
    let error: ApiErrorBody = {
      statusCode: response.status,
      code: 'HTTP_ERROR',
      message: 'A IA não respondeu. Tente de novo.',
    };

    try {
      const parsed = (await response.json()) as Partial<ApiErrorBody>;

      error = {
        statusCode: parsed.statusCode ?? response.status,
        code: parsed.code ?? error.code,
        message: parsed.message ?? error.message,
      };
    } catch {
      // Resposta sem JSON: fica a mensagem padrão.
    }

    throw new ApiRequestError(error);
  }

  return response.body.getReader();
}
