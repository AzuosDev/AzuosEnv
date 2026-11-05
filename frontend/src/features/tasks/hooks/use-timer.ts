import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { TimeEntry } from '@/api/types';
import { toast } from '@/components/ui/toast';
import { startTimer, stopTimer, timerQuery } from '../time-api';

export interface TimerControls {
  /** Lançamento em andamento do usuário neste workspace. */
  running: TimeEntry | null;
  start: (taskId: string) => void;
  stop: () => void;
  pending: boolean;
}

/** Relógio de um segundo; só roda quando existe cronômetro aberto. */
export function useTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) {
      return;
    }

    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(id);
    };
  }, [active]);

  return now;
}

/**
 * Cronômetro do workspace. A API só deixa um aberto por pessoa: iniciar outro
 * para o anterior, então o painel e a topbar leem a mesma query.
 */
export function useTimer(wsId: string): TimerControls {
  const queryClient = useQueryClient();
  const current = useQuery(timerQuery(wsId));
  const running = current.data?.entry ?? null;

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.timer(wsId) });
    void queryClient.invalidateQueries({ queryKey: ['workspaces', wsId, 'time', 'entries'] });
    void queryClient.invalidateQueries({ queryKey: ['workspaces', wsId, 'tasks'] });
  };

  const onError = (error: unknown): void => {
    toast.error(errorMessage(error));
  };

  const begin = useMutation({
    mutationFn: (taskId: string) => startTimer(wsId, taskId),
    onSuccess: ({ stopped }) => {
      invalidate();

      if (stopped) {
        toast.info('O cronômetro anterior foi parado.');
      }
    },
    onError,
  });

  const end = useMutation({
    mutationFn: () => stopTimer(wsId),
    onSuccess: () => {
      invalidate();
      toast.success('Cronômetro parado.');
    },
    onError,
  });

  return {
    running,
    start: (taskId) => {
      begin.mutate(taskId);
    },
    stop: () => {
      end.mutate();
    },
    pending: begin.isPending || end.isPending,
  };
}
