import { queryOptions } from '@tanstack/react-query';
import { api } from '@/api/client';
import { unwrap } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { CreateWorkspaceInput, Workspace } from '@/api/types';

/** Workspaces em que o usuário é membro ativo. */
async function listWorkspaces(): Promise<Workspace[]> {
  const page = unwrap(await api.GET('/api/v1/workspaces', { params: { query: { limit: 50 } } }));

  return page.items as Workspace[];
}

export const workspacesQuery = queryOptions({
  queryKey: queryKeys.workspaces(),
  queryFn: listWorkspaces,
  staleTime: 30_000,
});

export async function createWorkspace(body: CreateWorkspaceInput): Promise<Workspace> {
  return unwrap(await api.POST('/api/v1/workspaces', { body })) as Workspace;
}
