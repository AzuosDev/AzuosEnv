import { queryOptions } from '@tanstack/react-query';
import { api } from '@/api/client';
import { unwrap } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type {
  CalendarEvent,
  CreateEventInput,
  CreateTimeBlockInput,
  PlannerResult,
  UpdateEventInput,
} from '@/api/types';

/** Agenda, prazos do período e tarefas minhas sem bloco de tempo. */
export function plannerQuery(wsId: string, from: string, to: string) {
  return queryOptions({
    queryKey: queryKeys.planner(wsId, from, to),
    queryFn: async (): Promise<PlannerResult> =>
      unwrap(
        await api.GET('/api/v1/workspaces/{wsId}/me/planner', {
          params: { path: { wsId }, query: { from, to } },
        }),
      ) as PlannerResult,
    staleTime: 15_000,
  });
}

export async function createEvent(wsId: string, body: CreateEventInput): Promise<CalendarEvent> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/calendar/events', {
      params: { path: { wsId } },
      body,
    }),
  ) as CalendarEvent;
}

export async function updateEvent(
  wsId: string,
  eventId: string,
  body: UpdateEventInput,
): Promise<CalendarEvent> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/calendar/events/{eventId}', {
      params: { path: { wsId, eventId } },
      body,
    }),
  ) as CalendarEvent;
}

export async function deleteEvent(wsId: string, eventId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/calendar/events/{eventId}', {
      params: { path: { wsId, eventId } },
    }),
  );
}

/** Reserva um horário para a tarefa; o bloco é um evento com taskId. */
export async function createBlock(
  wsId: string,
  body: CreateTimeBlockInput,
): Promise<CalendarEvent> {
  return unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/me/planner/blocks', {
      params: { path: { wsId } },
      body,
    }),
  ) as CalendarEvent;
}
