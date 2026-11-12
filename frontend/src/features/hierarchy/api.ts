import { queryOptions } from '@tanstack/react-query';
import { api } from '@/api/client';
import { unwrap } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type {
  CreateFolderInput,
  CreateListInput,
  CreateSpaceInput,
  CreateStatusSetInput,
  Folder,
  ListNode,
  MoveFolderInput,
  MoveListInput,
  Permission,
  ReorderInput,
  ShareInput,
  Space,
  StatusSet,
  TrashEntityType,
  TrashItem,
  UpdateFolderInput,
  UpdateListInput,
  UpdateSpaceInput,
  UpdateStatusSetInput,
} from '@/api/types';

/* Spaces ---------------------------------------------------------------- */

export async function createSpace(wsId: string, body: CreateSpaceInput): Promise<Space> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/spaces', { params: { path: { wsId } }, body }),
  ) as Space;
}

export async function updateSpace(
  wsId: string,
  spaceId: string,
  body: UpdateSpaceInput,
): Promise<Space> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/spaces/{spaceId}', {
      params: { path: { wsId, spaceId } },
      body,
    }),
  ) as Space;
}

export async function reorderSpace(
  wsId: string,
  spaceId: string,
  body: ReorderInput,
): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/spaces/{spaceId}/reorder', {
      params: { path: { wsId, spaceId } },
      body,
    }),
  );
}

export async function archiveSpace(wsId: string, spaceId: string): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/spaces/{spaceId}/archive', {
      params: { path: { wsId, spaceId } },
    }),
  );
}

export async function unarchiveSpace(wsId: string, spaceId: string): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/spaces/{spaceId}/unarchive', {
      params: { path: { wsId, spaceId } },
    }),
  );
}

export async function deleteSpace(wsId: string, spaceId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/spaces/{spaceId}', {
      params: { path: { wsId, spaceId } },
    }),
  );
}

export async function restoreSpace(wsId: string, spaceId: string): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/spaces/{spaceId}/restore', {
      params: { path: { wsId, spaceId } },
    }),
  );
}

export function spaceQuery(wsId: string, spaceId: string) {
  return queryOptions({
    queryKey: queryKeys.space(wsId, spaceId),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/spaces/{spaceId}', {
          params: { path: { wsId, spaceId } },
        }),
      ) as Space,
  });
}

/* Folders --------------------------------------------------------------- */

export async function createFolder(wsId: string, body: CreateFolderInput): Promise<Folder> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/folders', { params: { path: { wsId } }, body }),
  ) as Folder;
}

export async function updateFolder(
  wsId: string,
  folderId: string,
  body: UpdateFolderInput,
): Promise<Folder> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/folders/{folderId}', {
      params: { path: { wsId, folderId } },
      body,
    }),
  ) as Folder;
}

export async function moveFolder(
  wsId: string,
  folderId: string,
  body: MoveFolderInput,
): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/folders/{folderId}/move', {
      params: { path: { wsId, folderId } },
      body,
    }),
  );
}

export async function reorderFolder(
  wsId: string,
  folderId: string,
  body: ReorderInput,
): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/folders/{folderId}/reorder', {
      params: { path: { wsId, folderId } },
      body,
    }),
  );
}

export async function archiveFolder(wsId: string, folderId: string): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/folders/{folderId}/archive', {
      params: { path: { wsId, folderId } },
    }),
  );
}

export async function unarchiveFolder(wsId: string, folderId: string): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/folders/{folderId}/unarchive', {
      params: { path: { wsId, folderId } },
    }),
  );
}

export async function deleteFolder(wsId: string, folderId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/folders/{folderId}', {
      params: { path: { wsId, folderId } },
    }),
  );
}

export async function restoreFolder(wsId: string, folderId: string): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/folders/{folderId}/restore', {
      params: { path: { wsId, folderId } },
    }),
  );
}

export function folderQuery(wsId: string, folderId: string) {
  return queryOptions({
    queryKey: queryKeys.folder(wsId, folderId),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/folders/{folderId}', {
          params: { path: { wsId, folderId } },
        }),
      ) as Folder,
  });
}

/* Lists ----------------------------------------------------------------- */

export async function createList(wsId: string, body: CreateListInput): Promise<ListNode> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/lists', { params: { path: { wsId } }, body }),
  ) as ListNode;
}

export async function updateList(
  wsId: string,
  listId: string,
  body: UpdateListInput,
): Promise<ListNode> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/lists/{listId}', {
      params: { path: { wsId, listId } },
      body,
    }),
  ) as ListNode;
}

export async function moveList(wsId: string, listId: string, body: MoveListInput): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/lists/{listId}/move', {
      params: { path: { wsId, listId } },
      body,
    }),
  );
}

export async function reorderList(wsId: string, listId: string, body: ReorderInput): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/lists/{listId}/reorder', {
      params: { path: { wsId, listId } },
      body,
    }),
  );
}

export async function archiveList(wsId: string, listId: string): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/lists/{listId}/archive', {
      params: { path: { wsId, listId } },
    }),
  );
}

export async function unarchiveList(wsId: string, listId: string): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/lists/{listId}/unarchive', {
      params: { path: { wsId, listId } },
    }),
  );
}

export async function deleteList(wsId: string, listId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/lists/{listId}', {
      params: { path: { wsId, listId } },
    }),
  );
}

export async function restoreList(wsId: string, listId: string): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/lists/{listId}/restore', {
      params: { path: { wsId, listId } },
    }),
  );
}

export function listQuery(wsId: string, listId: string) {
  return queryOptions({
    queryKey: queryKeys.list(wsId, listId),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/lists/{listId}', {
          params: { path: { wsId, listId } },
        }),
      ) as ListNode,
  });
}

/* Conjuntos de statuses ------------------------------------------------- */

export function statusSetQuery(wsId: string, statusSetId: string) {
  return queryOptions({
    queryKey: queryKeys.statusSet(wsId, statusSetId),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/status-sets/{statusSetId}', {
          params: { path: { wsId, statusSetId } },
        }),
      ) as StatusSet,
  });
}

export async function createStatusSet(
  wsId: string,
  body: CreateStatusSetInput,
): Promise<StatusSet> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/status-sets', { params: { path: { wsId } }, body }),
  ) as StatusSet;
}

export async function updateStatusSet(
  wsId: string,
  statusSetId: string,
  body: UpdateStatusSetInput,
): Promise<StatusSet> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/status-sets/{statusSetId}', {
      params: { path: { wsId, statusSetId } },
      body,
    }),
  ) as StatusSet;
}

/* Compartilhamento ------------------------------------------------------ */

export function permissionsQuery(
  wsId: string,
  resourceType: ShareInput['resourceType'],
  resourceId: string,
) {
  return queryOptions({
    queryKey: queryKeys.permissions(wsId, resourceType, resourceId),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/permissions', {
          params: { path: { wsId }, query: { resourceType, resourceId } },
        }),
      ) as Permission[],
  });
}

export async function share(wsId: string, body: ShareInput): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/permissions', { params: { path: { wsId } }, body }),
  );
}

export async function unshare(wsId: string, permissionId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/permissions/{permissionId}', {
      params: { path: { wsId, permissionId } },
    }),
  );
}

/* Arquivados e lixeira -------------------------------------------------- */

export function archivedQuery(wsId: string) {
  return queryOptions({
    queryKey: queryKeys.archived(wsId),
    queryFn: async (): Promise<TrashItem[]> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/archived', {
          params: { path: { wsId }, query: { limit: 100 } },
        }),
      ).items,
  });
}

export function trashQuery(wsId: string) {
  return queryOptions({
    queryKey: queryKeys.trash(wsId),
    queryFn: async (): Promise<TrashItem[]> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/trash', {
          params: { path: { wsId }, query: { limit: 100 } },
        }),
      ).items,
  });
}

export async function restoreTrashItem(
  wsId: string,
  entityType: TrashEntityType,
  entityId: string,
): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/trash/{entityType}/{entityId}/restore', {
      params: { path: { wsId, entityType, entityId } },
    }),
  );
}

export async function purgeTrashItem(
  wsId: string,
  entityType: TrashEntityType,
  entityId: string,
): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/trash/{entityType}/{entityId}', {
      params: { path: { wsId, entityType, entityId } },
    }),
  );
}
