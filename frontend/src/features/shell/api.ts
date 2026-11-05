import { queryOptions } from '@tanstack/react-query';
import { api } from '@/api/client';
import { unwrap } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { InboxCounts, WorkspaceTree } from '@/api/types';

/** Árvore de Spaces, Folders e Lists da sidebar, já filtrada por permissão. */
async function loadTree(wsId: string): Promise<WorkspaceTree> {
  return unwrap(await api.GET('/api/v1/workspaces/{wsId}/tree', { params: { path: { wsId } } }));
}

export function treeQuery(wsId: string) {
  return queryOptions({
    queryKey: queryKeys.tree(wsId),
    queryFn: () => loadTree(wsId),
  });
}

/** Contagens do Inbox; alimenta o badge da sidebar. */
async function loadInboxCounts(wsId: string): Promise<InboxCounts> {
  return unwrap(
    await api.GET('/api/v1/workspaces/{wsId}/inbox/counts', { params: { path: { wsId } } }),
  );
}

export function inboxCountsQuery(wsId: string) {
  return queryOptions({
    queryKey: queryKeys.inboxCounts(wsId),
    queryFn: () => loadInboxCounts(wsId),
  });
}
