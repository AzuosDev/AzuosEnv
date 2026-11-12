import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { api } from '@/api/client';
import { unwrap } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { components } from '@/api/schema';
import type {
  Automation,
  AutomationRecipe,
  AutomationResult,
  AutomationRun,
  CreateAutomationInput,
  UpdateAutomationInput,
} from '@/api/types';

export interface AutomationFilter extends Record<string, unknown> {
  locationType?: Automation['locationType'];
  locationId?: string;
}

/** Automações dos locais visíveis, mais novas primeiro. */
export function automationsQuery(wsId: string, filter: AutomationFilter = {}) {
  return queryOptions({
    queryKey: queryKeys.automations(wsId, filter),
    queryFn: async (): Promise<Automation[]> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/automations', {
          params: { path: { wsId }, query: { limit: 100, ...filter } },
        }),
      ).items as Automation[],
    staleTime: 30_000,
  });
}

/** Receitas prontas, iguais para todo workspace. */
export function recipesQuery(wsId: string) {
  return queryOptions({
    queryKey: queryKeys.automationRecipes(wsId),
    queryFn: async (): Promise<AutomationRecipe[]> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/automations/recipes', {
          params: { path: { wsId } },
        }),
      ).items as AutomationRecipe[],
    staleTime: 5 * 60_000,
  });
}

/** Execuções da automação por cursor, mais novas primeiro. */
export function runsQuery(wsId: string, automationId: string) {
  return infiniteQueryOptions({
    queryKey: queryKeys.automationRuns(wsId, automationId),
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/automations/{automationId}/runs', {
          params: {
            path: { wsId, automationId },
            query: { limit: 25, ...(pageParam ? { cursor: pageParam } : {}) },
          },
        }),
      ) as { items: AutomationRun[]; nextCursor: string | null },
    initialPageParam: '',
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

export async function createAutomation(
  wsId: string,
  body: CreateAutomationInput,
): Promise<AutomationResult> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/automations', {
      params: { path: { wsId } },
      body: body as components['schemas']['CreateAutomationDto'],
    }),
  ) as AutomationResult;
}

export async function updateAutomation(
  wsId: string,
  automationId: string,
  body: UpdateAutomationInput,
): Promise<AutomationResult> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/automations/{automationId}', {
      params: { path: { wsId, automationId } },
      body: body as components['schemas']['UpdateAutomationDto'],
    }),
  ) as AutomationResult;
}

export async function deleteAutomation(wsId: string, automationId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/automations/{automationId}', {
      params: { path: { wsId, automationId } },
    }),
  );
}
