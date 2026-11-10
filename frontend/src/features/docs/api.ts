import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { api, API_BASE_URL } from '@/api/client';
import { unwrap } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type {
  Comment,
  CreateDocInput,
  CreatePageCommentInput,
  CreatePageInput,
  DocHubTab,
  DocLocationType,
  DocPage,
  DocPageVersion,
  MovePageInput,
  PageCommentThread,
  PublicDoc,
  ShareDocResult,
  UpdateDocInput,
  UpdatePageInput,
  WorkspaceDoc,
} from '@/api/types';

export interface DocsFilter {
  tab: DocHubTab;
  locationType?: DocLocationType;
  locationId?: string;
}

/** Docs do hub por aba; recent e favorites não paginam (nextCursor null). */
export function docsQuery(wsId: string, filter: DocsFilter) {
  return queryOptions({
    queryKey: queryKeys.docs(wsId, filter.tab, filter.locationType, filter.locationId),
    queryFn: async (): Promise<WorkspaceDoc[]> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/docs', {
          params: {
            path: { wsId },
            query: {
              tab: filter.tab,
              locationType: filter.locationType,
              locationId: filter.locationId,
              limit: 100,
            },
          },
        }),
      ).items as WorkspaceDoc[],
    staleTime: 30_000,
  });
}

export function docQuery(wsId: string, docId: string) {
  return queryOptions({
    queryKey: queryKeys.doc(wsId, docId),
    queryFn: async (): Promise<WorkspaceDoc> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/docs/{docId}', {
          params: { path: { wsId, docId } },
        }),
      ) as WorkspaceDoc,
    staleTime: 30_000,
  });
}

/** Páginas do Doc em ordem manual; a árvore é montada por parentPageId. */
export function docPagesQuery(wsId: string, docId: string) {
  return queryOptions({
    queryKey: queryKeys.docPages(wsId, docId),
    queryFn: async (): Promise<DocPage[]> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/docs/{docId}/pages', {
          params: { path: { wsId, docId } },
        }),
      ).items as DocPage[],
    staleTime: 30_000,
  });
}

export function docPageQuery(wsId: string, pageId: string) {
  return queryOptions({
    queryKey: queryKeys.docPage(wsId, pageId),
    queryFn: async (): Promise<DocPage> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/pages/{pageId}', {
          params: { path: { wsId, pageId } },
        }),
      ) as DocPage,
    staleTime: 0,
  });
}

export function pageCommentsQuery(wsId: string, pageId: string) {
  return infiniteQueryOptions({
    queryKey: queryKeys.pageComments(wsId, pageId),
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/pages/{pageId}/comments', {
          params: {
            path: { wsId, pageId },
            query: { limit: 50, cursor: pageParam ?? undefined },
          },
        }),
      ) as { items: PageCommentThread[]; nextCursor: string | null },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

export function pageVersionsQuery(wsId: string, pageId: string) {
  return queryOptions({
    queryKey: queryKeys.pageVersions(wsId, pageId),
    queryFn: async (): Promise<DocPageVersion[]> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/pages/{pageId}/versions', {
          params: { path: { wsId, pageId }, query: { limit: 50 } },
        }),
      ).items as DocPageVersion[],
    staleTime: 0,
  });
}

/** Doc público por token: rota sem login, fora do cliente autenticado. */
export function publicDocQuery(token: string) {
  return queryOptions({
    queryKey: queryKeys.publicDoc(token),
    queryFn: async (): Promise<PublicDoc> => {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/public/docs/${encodeURIComponent(token)}`,
      );

      if (!response.ok) {
        throw new Error('Doc não encontrado.');
      }

      return (await response.json()) as PublicDoc;
    },
    retry: false,
    staleTime: 60_000,
  });
}

export async function createDoc(wsId: string, body: CreateDocInput): Promise<WorkspaceDoc> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/docs', { params: { path: { wsId } }, body }),
  ) as WorkspaceDoc;
}

export async function updateDoc(
  wsId: string,
  docId: string,
  body: UpdateDocInput,
): Promise<WorkspaceDoc> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/docs/{docId}', {
      params: { path: { wsId, docId } },
      body,
    }),
  ) as WorkspaceDoc;
}

export async function deleteDoc(wsId: string, docId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/docs/{docId}', {
      params: { path: { wsId, docId } },
    }),
  );
}

export async function shareDoc(
  wsId: string,
  docId: string,
  isPublic: boolean,
): Promise<ShareDocResult> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/docs/{docId}/share', {
      params: { path: { wsId, docId } },
      body: { public: isPublic },
    }),
  ) as ShareDocResult;
}

export async function createPage(
  wsId: string,
  docId: string,
  body: CreatePageInput,
): Promise<DocPage> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/docs/{docId}/pages', {
      params: { path: { wsId, docId } },
      body,
    }),
  ) as DocPage;
}

export async function updatePage(
  wsId: string,
  pageId: string,
  body: UpdatePageInput,
): Promise<DocPage> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/pages/{pageId}', {
      params: { path: { wsId, pageId } },
      body,
    }),
  ) as DocPage;
}

export async function movePage(
  wsId: string,
  pageId: string,
  body: MovePageInput,
): Promise<DocPage> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/pages/{pageId}/move', {
      params: { path: { wsId, pageId } },
      body,
    }),
  ) as DocPage;
}

export async function deletePage(wsId: string, pageId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/pages/{pageId}', {
      params: { path: { wsId, pageId } },
    }),
  );
}

export async function createPageComment(
  wsId: string,
  pageId: string,
  body: CreatePageCommentInput,
): Promise<Comment> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/pages/{pageId}/comments', {
      params: { path: { wsId, pageId } },
      body,
    }),
  ) as Comment;
}

export async function restorePageVersion(
  wsId: string,
  pageId: string,
  versionId: string,
): Promise<DocPage> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/pages/{pageId}/versions/{versionId}/restore', {
      params: { path: { wsId, pageId, versionId } },
    }),
  ) as DocPage;
}
