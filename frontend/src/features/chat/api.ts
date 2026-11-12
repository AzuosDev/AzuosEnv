import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { API_BASE_URL, api } from '@/api/client';
import { ApiRequestError, unwrap } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import { getAccessToken } from '@/api/token-store';
import type {
  Attachment,
  Channel,
  ChannelLocationType,
  ChannelRead,
  ChatActivity,
  CreateChannelInput,
  CreateMessageInput,
  Message,
  MessageToTaskResult,
  UpdateChannelInput,
  UpdateMessageInput,
} from '@/api/types';

/** Mensagens por lote da rolagem infinita. */
export const MESSAGE_PAGE_SIZE = 30;

/** Canais por lote; a lateral mostra todos de uma vez. */
export const CHANNEL_PAGE_SIZE = 100;

interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ChannelFilter extends Record<string, unknown> {
  locationType?: ChannelLocationType;
  locationId?: string;
  includeArchived?: boolean;
}

/* Canais ----------------------------------------------------------------- */

/** Canais visíveis, dos mais novos para os mais antigos. */
export function channelsQuery(wsId: string, filter: ChannelFilter = {}) {
  return queryOptions({
    queryKey: queryKeys.channels(wsId, filter),
    queryFn: async (): Promise<Channel[]> => {
      const page = unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/channels', {
          params: { path: { wsId }, query: { limit: CHANNEL_PAGE_SIZE, ...filter } },
        }),
      ) as Page<Channel>;

      return page.items;
    },
    staleTime: 15_000,
  });
}

export function channelQuery(wsId: string, channelId: string) {
  return queryOptions({
    queryKey: queryKeys.channel(wsId, channelId),
    queryFn: async (): Promise<Channel> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/channels/{channelId}', {
          params: { path: { wsId, channelId } },
        }),
      ) as Channel,
    staleTime: 15_000,
  });
}

/** Não lidas por canal, para a Sidebar Home e as pílulas da lateral. */
export function chatActivityQuery(wsId: string) {
  return queryOptions({
    queryKey: queryKeys.chatActivity(wsId),
    queryFn: async (): Promise<ChatActivity> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/me/chat-activity', {
          params: { path: { wsId } },
        }),
      ) as ChatActivity,
    staleTime: 15_000,
  });
}

export async function createChannel(wsId: string, body: CreateChannelInput): Promise<Channel> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/channels', { params: { path: { wsId } }, body }),
  ) as Channel;
}

/** Abre a conversa direta do par; a mesma DM volta nas chamadas seguintes. */
export async function openDm(wsId: string, userId: string): Promise<Channel> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/channels/dm', {
      params: { path: { wsId } },
      body: { userId },
    }),
  ) as Channel;
}

export async function updateChannel(
  wsId: string,
  channelId: string,
  body: UpdateChannelInput,
): Promise<Channel> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/channels/{channelId}', {
      params: { path: { wsId, channelId } },
      body,
    }),
  ) as Channel;
}

export async function archiveChannel(wsId: string, channelId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/channels/{channelId}', {
      params: { path: { wsId, channelId } },
    }),
  );
}

export async function joinChannel(wsId: string, channelId: string): Promise<Channel> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/channels/{channelId}/join', {
      params: { path: { wsId, channelId } },
    }),
  ) as Channel;
}

export async function leaveChannel(wsId: string, channelId: string): Promise<Channel> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/channels/{channelId}/leave', {
      params: { path: { wsId, channelId } },
    }),
  ) as Channel;
}

export async function addChannelMembers(
  wsId: string,
  channelId: string,
  userIds: string[],
): Promise<Channel> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/channels/{channelId}/members', {
      params: { path: { wsId, channelId } },
      body: { userIds },
    }),
  ) as Channel;
}

export async function removeChannelMember(
  wsId: string,
  channelId: string,
  userId: string,
): Promise<Channel> {
  return unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/channels/{channelId}/members/{userId}', {
      params: { path: { wsId, channelId, userId } },
    }),
  ) as Channel;
}

export async function markChannelRead(wsId: string, channelId: string): Promise<ChannelRead> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/channels/{channelId}/read', {
      params: { path: { wsId, channelId } },
    }),
  ) as ChannelRead;
}

/* Mensagens -------------------------------------------------------------- */

/**
 * Mensagens raiz do canal, das mais novas para as mais antigas. A rolagem
 * infinita é para cima: cada página nova é mais antiga que a anterior.
 */
export function messagesQuery(wsId: string, channelId: string) {
  return infiniteQueryOptions({
    queryKey: queryKeys.messages(wsId, channelId),
    queryFn: async ({ pageParam }): Promise<Page<Message>> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/channels/{channelId}/messages', {
          params: {
            path: { wsId, channelId },
            query: { limit: MESSAGE_PAGE_SIZE, ...(pageParam ? { cursor: pageParam } : {}) },
          },
        }),
      ) as Page<Message>,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 10_000,
  });
}

/** Respostas da thread, das mais antigas para as mais novas. */
export function repliesQuery(wsId: string, messageId: string) {
  return infiniteQueryOptions({
    queryKey: queryKeys.messageReplies(wsId, messageId),
    queryFn: async ({ pageParam }): Promise<Page<Message>> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/messages/{messageId}/replies', {
          params: {
            path: { wsId, messageId },
            query: { limit: MESSAGE_PAGE_SIZE, ...(pageParam ? { cursor: pageParam } : {}) },
          },
        }),
      ) as Page<Message>,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 10_000,
  });
}

export async function sendMessage(
  wsId: string,
  channelId: string,
  body: CreateMessageInput,
): Promise<Message> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/channels/{channelId}/messages', {
      params: { path: { wsId, channelId } },
      body,
    }),
  ) as Message;
}

export async function updateMessage(
  wsId: string,
  messageId: string,
  body: UpdateMessageInput,
): Promise<Message> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/messages/{messageId}', {
      params: { path: { wsId, messageId } },
      body,
    }),
  ) as Message;
}

export async function deleteMessage(wsId: string, messageId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/messages/{messageId}', {
      params: { path: { wsId, messageId } },
    }),
  );
}

/** Reagir de novo com o mesmo emoji tira a reação. */
export async function reactToMessage(
  wsId: string,
  messageId: string,
  emoji: string,
): Promise<Message> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/messages/{messageId}/reactions', {
      params: { path: { wsId, messageId } },
      body: { emoji },
    }),
  ) as Message;
}

export async function messageToTask(
  wsId: string,
  messageId: string,
  listId: string,
): Promise<MessageToTaskResult> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/messages/{messageId}/to-task', {
      params: { path: { wsId, messageId } },
      body: { listId },
    }),
  ) as MessageToTaskResult;
}

/* Anexos do canal -------------------------------------------------------- */

export function channelAttachmentsQuery(wsId: string, channelId: string) {
  return queryOptions({
    queryKey: queryKeys.channelAttachments(wsId, channelId),
    queryFn: async (): Promise<Attachment[]> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/channels/{channelId}/attachments', {
          params: { path: { wsId, channelId } },
        }),
      ) as Attachment[],
    staleTime: 15_000,
  });
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export interface ChannelUploadHandlers {
  /** 0 a 1; o navegador só reporta progresso de upload no XHR. */
  onProgress?: (ratio: number) => void;
}

/**
 * Envia o arquivo para o canal. Vai por XMLHttpRequest pelo mesmo motivo do
 * anexo da tarefa: é a única forma de acompanhar o progresso no navegador.
 */
export function uploadChannelAttachment(
  wsId: string,
  channelId: string,
  file: File,
  handlers: ChannelUploadHandlers = {},
): Promise<Attachment> {
  const url = `${API_BASE_URL}/api/v1/workspaces/${wsId}/channels/${channelId}/attachments`;
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
      const body = parseJson(request.responseText);

      if (request.status >= 200 && request.status < 300) {
        handlers.onProgress?.(1);
        resolve(body as Attachment);

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
