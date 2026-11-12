import { queryOptions } from '@tanstack/react-query';
import { api } from '@/api/client';
import { unwrap } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type {
  CreateTimeEntryInput,
  TimeEntry,
  TimerResult,
  TimerState,
  UpdateTimeEntryInput,
} from '@/api/types';

/** Cronômetro aberto do usuário no workspace; alimenta o espaço da topbar. */
export function timerQuery(wsId: string) {
  return queryOptions({
    queryKey: queryKeys.timer(wsId),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/time/timer/current', {
          params: { path: { wsId } },
        }),
      ) as TimerState,
    staleTime: 15_000,
  });
}

/** Lançamentos da tarefa, mais recentes primeiro. */
export function timeEntriesQuery(wsId: string, taskId: string) {
  return queryOptions({
    queryKey: queryKeys.timeEntries(wsId, taskId),
    queryFn: async (): Promise<TimeEntry[]> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/time/entries', {
          params: { path: { wsId }, query: { taskId, limit: 50 } },
        }),
      ).items as TimeEntry[],
    staleTime: 15_000,
  });
}

export async function startTimer(wsId: string, taskId: string): Promise<TimerResult> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/time/timer/start', {
      params: { path: { wsId } },
      body: { taskId },
    }),
  ) as TimerResult;
}

export async function stopTimer(wsId: string): Promise<TimeEntry> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/time/timer/stop', { params: { path: { wsId } } }),
  ) as TimeEntry;
}

export async function createTimeEntry(
  wsId: string,
  body: CreateTimeEntryInput,
): Promise<TimeEntry> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/time/entries', {
      params: { path: { wsId } },
      body,
    }),
  ) as TimeEntry;
}

export async function updateTimeEntry(
  wsId: string,
  entryId: string,
  body: UpdateTimeEntryInput,
): Promise<TimeEntry> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/time/entries/{entryId}', {
      params: { path: { wsId, entryId } },
      body,
    }),
  ) as TimeEntry;
}

export async function deleteTimeEntry(wsId: string, entryId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/time/entries/{entryId}', {
      params: { path: { wsId, entryId } },
    }),
  );
}
