import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { API_BASE_URL, api } from '@/api/client';
import { ApiRequestError, unwrap } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import { getAccessToken } from '@/api/token-store';
import type {
  Activity,
  Attachment,
  Comment,
  CommentThread,
  CreateCommentInput,
  CreateDependencyInput,
  TaskDependency,
  UpdateCommentInput,
} from '@/api/types';

/** Quantas threads e quantas linhas de histórico cada lote traz. */
export const FEED_PAGE_SIZE = 20;

interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/* Comentários ------------------------------------------------------------ */

/** Threads da tarefa, da mais antiga para a mais recente, por cursor. */
export function commentsQuery(wsId: string, idOrCustomId: string) {
  return infiniteQueryOptions({
    queryKey: queryKeys.comments(wsId, idOrCustomId),
    queryFn: async ({ pageParam }): Promise<Page<CommentThread>> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/tasks/{idOrCustomId}/comments', {
          params: {
            path: { wsId, idOrCustomId },
            query: { limit: FEED_PAGE_SIZE, ...(pageParam ? { cursor: pageParam } : {}) },
          },
        }),
      ) as Page<CommentThread>,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

export async function createComment(
  wsId: string,
  idOrCustomId: string,
  body: CreateCommentInput,
): Promise<Comment> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/tasks/{idOrCustomId}/comments', {
      params: { path: { wsId, idOrCustomId } },
      body,
    }),
  ) as Comment;
}

export async function updateComment(
  wsId: string,
  commentId: string,
  body: UpdateCommentInput,
): Promise<Comment> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/comments/{commentId}', {
      params: { path: { wsId, commentId } },
      body,
    }),
  ) as Comment;
}

/** Reagir de novo com o mesmo emoji tira a reação. */
export async function reactToComment(
  wsId: string,
  commentId: string,
  emoji: string,
): Promise<Comment> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/comments/{commentId}/reactions', {
      params: { path: { wsId, commentId } },
      body: { emoji },
    }),
  ) as Comment;
}

/** userId null tira o responsável do comentário. */
export async function assignComment(
  wsId: string,
  commentId: string,
  userId: string | null,
): Promise<Comment> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/comments/{commentId}/assign', {
      params: { path: { wsId, commentId } },
      body: userId === null ? {} : { userId },
    }),
  ) as Comment;
}

export async function setCommentResolved(
  wsId: string,
  commentId: string,
  resolved: boolean,
): Promise<Comment> {
  const path = resolved
    ? ('/api/v1/workspaces/{wsId}/comments/{commentId}/resolve' as const)
    : ('/api/v1/workspaces/{wsId}/comments/{commentId}/unresolve' as const);

  return unwrap(await api.POST(path, { params: { path: { wsId, commentId } } })) as Comment;
}

export async function deleteComment(wsId: string, commentId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/comments/{commentId}', {
      params: { path: { wsId, commentId } },
    }),
  );
}

/* Histórico -------------------------------------------------------------- */

/** Histórico da tarefa, do mais recente para o mais antigo, por cursor. */
export function taskActivityQuery(wsId: string, idOrCustomId: string) {
  return infiniteQueryOptions({
    queryKey: queryKeys.taskActivity(wsId, idOrCustomId),
    queryFn: async ({ pageParam }): Promise<Page<Activity>> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/tasks/{idOrCustomId}/activity', {
          params: {
            path: { wsId, idOrCustomId },
            query: { limit: FEED_PAGE_SIZE, ...(pageParam ? { cursor: pageParam } : {}) },
          },
        }),
      ) as Page<Activity>,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

/* Anexos ----------------------------------------------------------------- */

export function attachmentsQuery(wsId: string, idOrCustomId: string) {
  return queryOptions({
    queryKey: queryKeys.attachments(wsId, idOrCustomId),
    queryFn: async (): Promise<Attachment[]> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/tasks/{idOrCustomId}/attachments', {
          params: { path: { wsId, idOrCustomId } },
        }),
      ) as Attachment[],
    staleTime: 15_000,
  });
}

export interface UploadHandlers {
  /** 0 a 1; o navegador só reporta progresso de upload no XHR. */
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
}

/**
 * Envia o arquivo para a tarefa. Vai por XMLHttpRequest porque é a única forma
 * de acompanhar o progresso do upload no navegador; o token é o mesmo da API.
 */
export function uploadAttachment(
  wsId: string,
  idOrCustomId: string,
  file: File,
  handlers: UploadHandlers = {},
): Promise<Attachment> {
  const url = `${API_BASE_URL}/api/v1/workspaces/${wsId}/tasks/${idOrCustomId}/attachments`;
  const form = new FormData();

  form.append('file', file, file.name);

  return new Promise<Attachment>((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open('POST', url);
    request.withCredentials = true;

    const token = getAccessToken();

    if (token) {
      request.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        handlers.onProgress?.(event.loaded / event.total);
      }
    });

    request.addEventListener('load', () => {
      const body: unknown = parseJson(request.responseText);

      if (request.status >= 200 && request.status < 300) {
        handlers.onProgress?.(1);
        resolve(body as Attachment);

        return;
      }

      reject(
        new ApiRequestError({
          statusCode: request.status,
          code: codeOf(body),
          message: messageOf(body) ?? 'Não foi possível enviar o arquivo.',
        }),
      );
    });

    request.addEventListener('error', () => {
      reject(
        new ApiRequestError({
          statusCode: 0,
          code: 'NETWORK_ERROR',
          message: 'A conexão caiu durante o envio.',
        }),
      );
    });

    handlers.signal?.addEventListener('abort', () => {
      request.abort();
    });

    request.send(form);
  });
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function codeOf(body: unknown): string {
  const code = (body as { code?: unknown } | null)?.code;

  return typeof code === 'string' ? code : 'UPLOAD_FAILED';
}

function messageOf(body: unknown): string | null {
  const message = (body as { message?: unknown } | null)?.message;

  return typeof message === 'string' ? message : null;
}

/**
 * Bytes do anexo já autenticados, como blob local. O download direto pela URL
 * não funcionaria: o access token vive só em memória, não em cookie.
 */
export async function downloadAttachment(wsId: string, attachmentId: string): Promise<Blob> {
  const { data, response } = await api.GET(
    '/api/v1/workspaces/{wsId}/attachments/{attachmentId}/download',
    { params: { path: { wsId, attachmentId } }, parseAs: 'blob' },
  );
  const blob = data as unknown;

  if (!response.ok || !(blob instanceof Blob)) {
    throw new ApiRequestError({
      statusCode: response.status,
      code: 'DOWNLOAD_FAILED',
      message: 'Não foi possível baixar o arquivo.',
    });
  }

  return blob;
}

export async function deleteAttachment(wsId: string, attachmentId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/attachments/{attachmentId}', {
      params: { path: { wsId, attachmentId } },
    }),
  );
}

/* Dependências ----------------------------------------------------------- */

/** Dependências nos dois sentidos: o que a tarefa aguarda e o que ela bloqueia. */
export function dependenciesQuery(wsId: string, idOrCustomId: string) {
  return queryOptions({
    queryKey: queryKeys.dependencies(wsId, idOrCustomId),
    queryFn: async (): Promise<TaskDependency[]> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/tasks/{idOrCustomId}/dependencies', {
          params: { path: { wsId, idOrCustomId } },
        }),
      ) as TaskDependency[],
    staleTime: 15_000,
  });
}

export async function createDependency(
  wsId: string,
  idOrCustomId: string,
  body: CreateDependencyInput,
): Promise<TaskDependency> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/tasks/{idOrCustomId}/dependencies', {
      params: { path: { wsId, idOrCustomId } },
      body,
    }),
  ) as TaskDependency;
}

export async function deleteDependency(wsId: string, dependencyId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/dependencies/{dependencyId}', {
      params: { path: { wsId, dependencyId } },
    }),
  );
}
