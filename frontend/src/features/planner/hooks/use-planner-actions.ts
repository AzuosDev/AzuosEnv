import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { queryKeys } from '@/api/keys';
import { errorMessage } from '@/api/errors';
import type {
  CalendarEvent,
  CreateEventInput,
  PlannerResult,
  PlannerTask,
  UpdateEventInput,
} from '@/api/types';
import { toast } from '@/components/ui/toast';
import { createBlock, createEvent, deleteEvent, updateEvent } from '../api';
import type { PlannerRange } from '../planner-model';

export interface PlannerActions {
  /** Reserva o horário da tarefa e tira ela da lista "Para agendar". */
  scheduleTask: (task: PlannerTask, slot: { start: string; end: string }) => Promise<void>;
  moveBlock: (eventId: string, slot: { start: string; end: string }) => Promise<void>;
  saveEvent: (body: CreateEventInput) => Promise<void>;
  patchEvent: (eventId: string, body: UpdateEventInput) => Promise<void>;
  removeEvent: (event: CalendarEvent) => Promise<void>;
}

/**
 * Escritas do Planner. A grade é pintada na hora e volta atrás no erro: arrastar
 * um bloco não pode esperar a resposta da API para sair do lugar.
 */
export function usePlannerActions(wsId: string, range: PlannerRange): PlannerActions {
  const client = useQueryClient();
  const key = queryKeys.planner(wsId, range.from, range.to);

  const snapshot = useCallback(
    (): PlannerResult | undefined => client.getQueryData<PlannerResult>(key),
    [client, key],
  );

  const write = useCallback(
    (next: (previous: PlannerResult) => PlannerResult): void => {
      client.setQueryData<PlannerResult>(key, (previous) => (previous ? next(previous) : previous));
    },
    [client, key],
  );

  const restore = useCallback(
    (previous: PlannerResult | undefined, error: unknown): void => {
      if (previous) {
        client.setQueryData(key, previous);
      }

      toast.error(errorMessage(error));
    },
    [client, key],
  );

  const refresh = useCallback((): void => {
    void client.invalidateQueries({ queryKey: ['workspaces', wsId, 'planner'] });
    void client.invalidateQueries({ queryKey: ['workspaces', wsId, 'tasks'] });
  }, [client, wsId]);

  const scheduleTask = useCallback(
    async (task: PlannerTask, slot: { start: string; end: string }): Promise<void> => {
      const previous = snapshot();

      write((state) => ({
        ...state,
        unscheduledTasks: state.unscheduledTasks.filter((item) => item.id !== task.id),
      }));

      try {
        const event = await createBlock(wsId, { taskId: task.id, ...slot });

        write((state) => ({ ...state, events: [...state.events, event] }));
      } catch (error) {
        restore(previous, error);

        return;
      }

      refresh();
    },
    [refresh, restore, snapshot, write, wsId],
  );

  const moveBlock = useCallback(
    async (eventId: string, slot: { start: string; end: string }): Promise<void> => {
      const previous = snapshot();

      write((state) => ({
        ...state,
        events: state.events.map((event) => (event.id === eventId ? { ...event, ...slot } : event)),
      }));

      try {
        const event = await updateEvent(wsId, eventId, slot);

        write((state) => ({
          ...state,
          events: state.events.map((item) => (item.id === eventId ? event : item)),
        }));
      } catch (error) {
        restore(previous, error);

        return;
      }

      refresh();
    },
    [refresh, restore, snapshot, write, wsId],
  );

  const saveEvent = useCallback(
    async (body: CreateEventInput): Promise<void> => {
      try {
        const event = await createEvent(wsId, body);

        write((state) => ({ ...state, events: [...state.events, event] }));
        toast.success('Evento criado.');
      } catch (error) {
        toast.error(errorMessage(error));

        return;
      }

      refresh();
    },
    [refresh, write, wsId],
  );

  const patchEvent = useCallback(
    async (eventId: string, body: UpdateEventInput): Promise<void> => {
      const previous = snapshot();

      try {
        const event = await updateEvent(wsId, eventId, body);

        write((state) => ({
          ...state,
          events: state.events.map((item) => (item.id === eventId ? event : item)),
        }));
      } catch (error) {
        restore(previous, error);

        return;
      }

      refresh();
    },
    [refresh, restore, snapshot, write, wsId],
  );

  const removeEvent = useCallback(
    async (event: CalendarEvent): Promise<void> => {
      const previous = snapshot();

      write((state) => ({
        ...state,
        events: state.events.filter((item) => item.id !== event.id),
      }));

      try {
        await deleteEvent(wsId, event.id);
      } catch (error) {
        restore(previous, error);

        return;
      }

      toast.success(event.taskId ? 'Bloco removido do calendário.' : 'Evento excluído.');
      refresh();
    },
    [refresh, restore, snapshot, write, wsId],
  );

  return { scheduleTask, moveBlock, saveEvent, patchEvent, removeEvent };
}
