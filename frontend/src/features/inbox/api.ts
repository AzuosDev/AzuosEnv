import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { api } from '@/api/client';
import { unwrap } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type {
  AssignedCommentStatus,
  Comment,
  CreateReminderInput,
  InboxTab,
  MyTasksResult,
  Notification,
  Reminder,
  ReminderStatus,
  UpdateReminderInput,
} from '@/api/types';

/** Quantas entradas cada lote do Inbox traz. */
export const INBOX_PAGE_SIZE = 25;

interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** Entradas do Inbox da aba, por cursor. */
export function inboxQuery(wsId: string, tab: InboxTab) {
  return infiniteQueryOptions({
    queryKey: queryKeys.inbox(wsId, tab),
    queryFn: async ({ pageParam }): Promise<Page<Notification>> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/inbox', {
          params: {
            path: { wsId },
            query: {
              tab,
              limit: INBOX_PAGE_SIZE,
              ...(pageParam ? { cursor: pageParam } : {}),
            },
          },
        }),
      ) as Page<Notification>,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: Page<Notification>) => last.nextCursor ?? undefined,
  });
}

/** Respostas aos meus comentários, da mais nova para a mais antiga. */
export function repliesQuery(wsId: string) {
  return infiniteQueryOptions({
    queryKey: queryKeys.replies(wsId),
    queryFn: async ({ pageParam }): Promise<Page<Comment>> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/replies', {
          params: {
            path: { wsId },
            query: { limit: INBOX_PAGE_SIZE, ...(pageParam ? { cursor: pageParam } : {}) },
          },
        }),
      ) as Page<Comment>,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: Page<Comment>) => last.nextCursor ?? undefined,
  });
}

/** Comentários atribuídos a mim, abertos ou já resolvidos. */
export function assignedCommentsQuery(wsId: string, status: AssignedCommentStatus) {
  return infiniteQueryOptions({
    queryKey: queryKeys.assignedComments(wsId, status),
    queryFn: async ({ pageParam }): Promise<Page<Comment>> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/assigned-comments', {
          params: {
            path: { wsId },
            query: {
              status,
              limit: INBOX_PAGE_SIZE,
              ...(pageParam ? { cursor: pageParam } : {}),
            },
          },
        }),
      ) as Page<Comment>,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: Page<Comment>) => last.nextCursor ?? undefined,
  });
}

export async function markNotificationRead(wsId: string, notificationId: string): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/inbox/{notificationId}/read', {
      params: { path: { wsId, notificationId } },
    }),
  );
}

export async function markNotificationUnread(wsId: string, notificationId: string): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/inbox/{notificationId}/unread', {
      params: { path: { wsId, notificationId } },
    }),
  );
}

export async function readAllNotifications(wsId: string): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/inbox/read-all', { params: { path: { wsId } } }),
  );
}

export async function snoozeNotification(
  wsId: string,
  notificationId: string,
  until: string,
): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/inbox/{notificationId}/snooze', {
      params: { path: { wsId, notificationId } },
      body: { until },
    }),
  );
}

export async function clearNotification(wsId: string, notificationId: string): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/inbox/{notificationId}/clear', {
      params: { path: { wsId, notificationId } },
    }),
  );
}

/** Lembretes pendentes ou concluídos. */
export function remindersQuery(wsId: string, status: ReminderStatus) {
  return queryOptions({
    queryKey: queryKeys.reminders(wsId, status),
    queryFn: async (): Promise<Reminder[]> =>
      (
        unwrap(
          await api.GET('/api/v1/workspaces/{wsId}/reminders', {
            params: { path: { wsId }, query: { status, limit: 100 } },
          }),
        ) as Page<Reminder>
      ).items,
  });
}

export async function createReminder(wsId: string, body: CreateReminderInput): Promise<Reminder> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/reminders', { params: { path: { wsId } }, body }),
  ) as Reminder;
}

export async function updateReminder(
  wsId: string,
  reminderId: string,
  body: UpdateReminderInput,
): Promise<Reminder> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/reminders/{reminderId}', {
      params: { path: { wsId, reminderId } },
      body,
    }),
  ) as Reminder;
}

export async function deleteReminder(wsId: string, reminderId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/reminders/{reminderId}', {
      params: { path: { wsId, reminderId } },
    }),
  );
}

/** Minhas tarefas por seção de prazo, já no fuso do usuário. */
export function myTasksQuery(wsId: string) {
  return queryOptions({
    queryKey: queryKeys.myTasks(wsId),
    queryFn: async (): Promise<MyTasksResult> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/my-tasks', { params: { path: { wsId } } }),
      ) as MyTasksResult,
  });
}
