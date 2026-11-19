import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { API_BASE_URL, api } from '@/api/client';
import { ApiRequestError, unwrap } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import { getAccessToken } from '@/api/token-store';
import type {
  CreateWaContactInput,
  SendWaTemplateInput,
  SendWaTextInput,
  Task,
  UpdateWaContactInput,
  WaAccessEntry,
  WaAccessLevel,
  WaConnectionStatus,
  WaContact,
  WaConversationFilter,
  WaConversationItem,
  WaConversationPriority,
  WaMessage,
  WaQuickReply,
  WaTemplate,
} from '@/api/types';

interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** Conversas por lote da lista; a rolagem busca a próxima com "Carregar mais". */
export const CONVERSATION_PAGE_SIZE = 25;

/** Mensagens por lote; a rolagem infinita é para cima, como no chat. */
export const WA_MESSAGE_PAGE_SIZE = 30;

/* Acesso ao módulo ------------------------------------------------------- */

/**
 * Nível de quem está logado. Sem acesso o backend responde 404 em todo o
 * módulo, então aqui o 404 vira `null` e a navegação esconde o item.
 */
export function myWaAccessQuery(wsId: string) {
  return queryOptions({
    queryKey: queryKeys.waMyAccess(wsId),
    queryFn: async (): Promise<WaAccessLevel | null> => {
      const { data, response } = await api.GET('/api/v1/workspaces/{wsId}/whatsapp/access/me', {
        params: { path: { wsId } },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok || !data) {
        throw new ApiRequestError({
          statusCode: response.status,
          code: 'WHATSAPP_ACCESS_FAILED',
          message: 'Não foi possível conferir o acesso ao WhatsApp.',
        });
      }

      return data.level;
    },
    staleTime: 60_000,
  });
}

export function waAccessQuery(wsId: string) {
  return queryOptions({
    queryKey: queryKeys.waAccess(wsId),
    queryFn: async (): Promise<WaAccessEntry[]> =>
      (
        unwrap(
          await api.GET('/api/v1/workspaces/{wsId}/whatsapp/access', {
            params: { path: { wsId } },
          }),
        ) as { items: WaAccessEntry[] }
      ).items,
    staleTime: 30_000,
  });
}

export async function grantWaAccess(
  wsId: string,
  userId: string,
  level: WaAccessLevel,
): Promise<void> {
  unwrap(
    await api.PUT('/api/v1/workspaces/{wsId}/whatsapp/access/{userId}', {
      params: { path: { wsId, userId } },
      body: { level },
    }),
  );
}

export async function revokeWaAccess(wsId: string, userId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/whatsapp/access/{userId}', {
      params: { path: { wsId, userId } },
    }),
  );
}

/* Conexão ---------------------------------------------------------------- */

export function waConnectionQuery(wsId: string) {
  return queryOptions({
    queryKey: queryKeys.waConnection(wsId),
    queryFn: async (): Promise<WaConnectionStatus> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/whatsapp/connection', {
          params: { path: { wsId } },
        }),
      ) as WaConnectionStatus,
    staleTime: 30_000,
  });
}

export async function saveWaConnection(
  wsId: string,
  body: {
    phoneNumberId: string;
    wabaId: string;
    accessToken: string;
    appSecret: string;
    verifyToken: string;
  },
): Promise<WaConnectionStatus> {
  return unwrap(
    await api.PUT('/api/v1/workspaces/{wsId}/whatsapp/connection', {
      params: { path: { wsId } },
      body,
    }),
  ) as WaConnectionStatus;
}

export async function testWaConnection(wsId: string): Promise<WaConnectionStatus> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/whatsapp/connection/test', {
      params: { path: { wsId } },
    }),
  ) as WaConnectionStatus;
}

export function waTemplatesQuery(wsId: string, enabled: boolean) {
  return queryOptions({
    queryKey: queryKeys.waTemplates(wsId),
    queryFn: async (): Promise<WaTemplate[]> =>
      (
        unwrap(
          await api.GET('/api/v1/workspaces/{wsId}/whatsapp/templates', {
            params: { path: { wsId } },
          }),
        ) as { items: WaTemplate[] }
      ).items,
    staleTime: 5 * 60_000,
    enabled,
  });
}

/* Conversas -------------------------------------------------------------- */

export interface ConversationQuery {
  filter: WaConversationFilter;
  q?: string;
}

export function waConversationsQuery(wsId: string, params: ConversationQuery) {
  const search = (params.q ?? '').trim();

  return infiniteQueryOptions({
    queryKey: queryKeys.waConversations(wsId, { filter: params.filter, q: search }),
    queryFn: async ({ pageParam }): Promise<Page<WaConversationItem>> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/whatsapp/conversations', {
          params: {
            path: { wsId },
            query: {
              limit: CONVERSATION_PAGE_SIZE,
              filter: params.filter,
              ...(search === '' ? {} : { q: search }),
              ...(pageParam ? { cursor: pageParam } : {}),
            },
          },
        }),
      ) as Page<WaConversationItem>,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 10_000,
  });
}

export function waConversationQuery(wsId: string, conversationId: string) {
  return queryOptions({
    queryKey: queryKeys.waConversation(wsId, conversationId),
    queryFn: async (): Promise<WaConversationItem> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/whatsapp/conversations/{conversationId}', {
          params: { path: { wsId, conversationId } },
        }),
      ) as WaConversationItem,
    staleTime: 10_000,
  });
}

export async function markWaConversationRead(wsId: string, conversationId: string): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/whatsapp/conversations/{conversationId}/read', {
      params: { path: { wsId, conversationId } },
    }),
  );
}

export async function assignWaConversation(
  wsId: string,
  conversationId: string,
  assigneeId: string | null,
): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/whatsapp/conversations/{conversationId}/assign', {
      params: { path: { wsId, conversationId } },
      body: { assigneeId },
    }),
  );
}

export async function setWaPriority(
  wsId: string,
  conversationId: string,
  priority: WaConversationPriority,
): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/whatsapp/conversations/{conversationId}/priority', {
      params: { path: { wsId, conversationId } },
      body: { priority },
    }),
  );
}

/** `mode: 'bot'` sem data é o "Devolver ao bot": a pausa é limpa. */
export async function setWaMode(
  wsId: string,
  conversationId: string,
  mode: 'bot' | 'human',
): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/whatsapp/conversations/{conversationId}/mode', {
      params: { path: { wsId, conversationId } },
      body: { mode },
    }),
  );
}

export async function closeWaConversation(wsId: string, conversationId: string): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/whatsapp/conversations/{conversationId}/close', {
      params: { path: { wsId, conversationId } },
    }),
  );
}

export async function reopenWaConversation(wsId: string, conversationId: string): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/whatsapp/conversations/{conversationId}/reopen', {
      params: { path: { wsId, conversationId } },
    }),
  );
}

export async function waConversationToTask(
  wsId: string,
  conversationId: string,
  listId: string,
): Promise<Task> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/whatsapp/conversations/{conversationId}/task', {
      params: { path: { wsId, conversationId } },
      body: { listId },
    }),
  ) as Task;
}

export async function waConversationToLead(wsId: string, conversationId: string): Promise<Task> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/whatsapp/conversations/{conversationId}/lead', {
      params: { path: { wsId, conversationId } },
      body: {},
    }),
  ) as Task;
}

/* Mensagens -------------------------------------------------------------- */

export function waMessagesQuery(wsId: string, conversationId: string) {
  return infiniteQueryOptions({
    queryKey: queryKeys.waMessages(wsId, conversationId),
    queryFn: async ({ pageParam }): Promise<Page<WaMessage>> =>
      unwrap(
        await api.GET(
          '/api/v1/workspaces/{wsId}/whatsapp/conversations/{conversationId}/messages',
          {
            params: {
              path: { wsId, conversationId },
              query: {
                limit: WA_MESSAGE_PAGE_SIZE,
                ...(pageParam ? { cursor: pageParam } : {}),
              },
            },
          },
        ),
      ) as Page<WaMessage>,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 5_000,
  });
}

export async function sendWaText(
  wsId: string,
  conversationId: string,
  body: SendWaTextInput,
): Promise<WaMessage> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/whatsapp/conversations/{conversationId}/messages', {
      params: { path: { wsId, conversationId } },
      body,
    }),
  ) as WaMessage;
}

export async function sendWaTemplate(
  wsId: string,
  conversationId: string,
  body: SendWaTemplateInput,
): Promise<WaMessage> {
  return unwrap(
    await api.POST(
      '/api/v1/workspaces/{wsId}/whatsapp/conversations/{conversationId}/messages/template',
      { params: { path: { wsId, conversationId } }, body },
    ),
  ) as WaMessage;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * Arquivo enviado na conversa. Vai por XMLHttpRequest pelo mesmo motivo do
 * anexo da tarefa: é a única forma de acompanhar o progresso no navegador.
 */
export function sendWaMedia(
  wsId: string,
  conversationId: string,
  file: File,
  options: { caption?: string; replyTo?: string; onProgress?: (ratio: number) => void } = {},
): Promise<WaMessage> {
  const url = `${API_BASE_URL}/api/v1/workspaces/${wsId}/whatsapp/conversations/${conversationId}/messages/media`;
  const form = new FormData();

  form.append('file', file, file.name);

  if (options.caption) {
    form.append('caption', options.caption);
  }

  if (options.replyTo) {
    form.append('replyTo', options.replyTo);
  }

  return new Promise<WaMessage>((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open('POST', url);
    request.withCredentials = true;

    const token = getAccessToken();

    if (token) {
      request.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        options.onProgress?.(event.loaded / event.total);
      }
    });

    request.addEventListener('load', () => {
      const body = parseJson(request.responseText);

      if (request.status >= 200 && request.status < 300) {
        options.onProgress?.(1);
        resolve(body as WaMessage);

        return;
      }

      const message = (body as { message?: unknown } | null)?.message;

      reject(
        new ApiRequestError({
          statusCode: request.status,
          code: 'UPLOAD_FAILED',
          message: typeof message === 'string' ? message : 'Não foi possível enviar o arquivo.',
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

    request.send(form);
  });
}

/**
 * Bytes do arquivo da mensagem, já autenticados. A URL da Meta expira e o
 * access token vive só em memória: o arquivo vem pela API e vira blob local.
 */
export async function downloadWaMedia(
  wsId: string,
  conversationId: string,
  messageId: string,
): Promise<Blob> {
  const { data, response } = await api.GET(
    '/api/v1/workspaces/{wsId}/whatsapp/conversations/{conversationId}/messages/{messageId}/media',
    { params: { path: { wsId, conversationId, messageId } }, parseAs: 'blob' },
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

/* Contatos --------------------------------------------------------------- */

export function waContactsQuery(wsId: string, term = '') {
  const search = term.trim();

  return infiniteQueryOptions({
    queryKey: queryKeys.waContacts(wsId, search),
    queryFn: async ({ pageParam }): Promise<Page<WaContact>> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/whatsapp/contacts', {
          params: {
            path: { wsId },
            query: {
              limit: 50,
              ...(search === '' ? {} : { q: search }),
              ...(pageParam ? { cursor: pageParam } : {}),
            },
          },
        }),
      ) as Page<WaContact>,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

export async function createWaContact(
  wsId: string,
  body: CreateWaContactInput,
): Promise<WaContact> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/whatsapp/contacts', {
      params: { path: { wsId } },
      body,
    }),
  ) as WaContact;
}

export async function updateWaContact(
  wsId: string,
  contactId: string,
  body: UpdateWaContactInput,
): Promise<WaContact> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/whatsapp/contacts/{contactId}', {
      params: { path: { wsId, contactId } },
      body,
    }),
  ) as WaContact;
}

export async function deleteWaContact(wsId: string, contactId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/whatsapp/contacts/{contactId}', {
      params: { path: { wsId, contactId } },
    }),
  );
}

/* Respostas rápidas ------------------------------------------------------ */

/** Com a conversa as variáveis ({nome}, {numero}) já vêm resolvidas. */
export function waQuickRepliesQuery(wsId: string, conversationId: string, term: string) {
  const search = term.trim();

  return queryOptions({
    queryKey: queryKeys.waQuickReplies(wsId, conversationId, search),
    queryFn: async (): Promise<WaQuickReply[]> =>
      (
        unwrap(
          await api.GET('/api/v1/workspaces/{wsId}/whatsapp/quick-replies', {
            params: {
              path: { wsId },
              query: { limit: 20, conversationId, ...(search === '' ? {} : { q: search }) },
            },
          }),
        ) as Page<WaQuickReply>
      ).items,
    staleTime: 30_000,
  });
}
