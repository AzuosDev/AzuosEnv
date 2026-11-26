import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiRequestError } from '@/api/errors';

/** Ciclo normal com a aba visível. */
const DEFAULT_INTERVAL_MS = 30_000;

/** Teto do backoff: depois de erro atrás de erro, uma tentativa a cada 5 min. */
const DEFAULT_MAX_DELAY_MS = 5 * 60_000;

export interface SincronizacaoOptions {
  /**
   * Tempo real de pé. Com ele a reserva fica parada; quando cai, o ciclo
   * assume, e quando volta há uma última busca para pegar o intervalo perdido.
   */
  realtime: boolean;
  /**
   * Há sessão para buscar. Sem isso a reserva fica muda: ao sair, o tempo real
   * cai junto e uma rodada de buscas sem sessão viraria uma enxurrada de 401,
   * cada um declarando a sessão perdida de novo.
   */
  enabled?: boolean;
  /** Busca o que mudou desde a última vez. Lança o erro para o backoff agir. */
  sync: () => Promise<void>;
  intervalMs?: number;
  maxDelayMs?: number;
}

export interface SincronizacaoState {
  /** Uma busca em andamento. */
  syncing: boolean;
  /** Quando a última busca terminou bem. */
  lastSyncAt: number | null;
  /** Espera atual entre buscas; cresce a cada erro. */
  delayMs: number;
  /** Força uma busca agora (botão "atualizar"). */
  syncNow: () => void;
}

/**
 * Reserva de sincronização: mantém a tela em dia quando o tempo real não está
 * de pé — por queda de conexão, por bloqueio de rede ou porque o deploy não tem
 * transporte. Com a aba oculta não gasta uma requisição; ao voltar o foco ou a
 * rede busca na hora; erro atrás de erro afasta as tentativas até 5 min, e um
 * 429 com `Retry-After` manda no prazo. Nunca empilha chamada: uma por vez.
 */
export function useSincronizacao({
  realtime,
  sync,
  enabled: hasSession = true,
  intervalMs = DEFAULT_INTERVAL_MS,
  maxDelayMs = DEFAULT_MAX_DELAY_MS,
}: SincronizacaoOptions): SincronizacaoState {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [delayMs, setDelayMs] = useState(intervalMs);

  const latestSync = useRef(sync);
  const running = useRef(false);
  const timer = useRef<number | null>(null);
  const delay = useRef(intervalMs);
  const enabled = useRef(!realtime && hasSession);
  const wasRealtime = useRef(realtime);

  useEffect(() => {
    latestSync.current = sync;
  }, [sync]);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const visible = (): boolean =>
    typeof document === 'undefined' || document.visibilityState === 'visible';

  /** Uma busca por vez; o resultado define a espera até a próxima. */
  const run = useCallback(
    async (schedule: (ms: number) => void): Promise<void> => {
      if (running.current) {
        return;
      }

      running.current = true;
      setSyncing(true);

      try {
        await latestSync.current();
        delay.current = intervalMs;
        setDelayMs(intervalMs);
        setLastSyncAt(Date.now());
      } catch (error) {
        const asked = error instanceof ApiRequestError ? error.retryAfterMs : null;
        const next =
          asked !== null && asked > 0
            ? Math.min(asked, maxDelayMs)
            : Math.min(delay.current * 2, maxDelayMs);

        delay.current = next;
        setDelayMs(next);
      } finally {
        running.current = false;
        setSyncing(false);
        schedule(delay.current);
      }
    },
    [intervalMs, maxDelayMs],
  );

  useEffect(() => {
    enabled.current = !realtime && hasSession;

    const schedule = (ms: number): void => {
      clear();

      // Aba oculta não agenda nada: o retorno do foco busca na hora.
      if (!enabled.current || !visible()) {
        return;
      }

      timer.current = window.setTimeout(() => {
        void run(schedule);
      }, ms);
    };

    const now = (): void => {
      if (!enabled.current || !visible()) {
        return;
      }

      void run(schedule);
    };

    // O tempo real voltou: uma busca de acerto e o ciclo se desliga.
    if (realtime && hasSession && !wasRealtime.current) {
      clear();
      void run(() => undefined);
    }

    wasRealtime.current = realtime;

    if (!hasSession) {
      clear();
    } else if (!realtime) {
      delay.current = intervalMs;
      setDelayMs(intervalMs);
      // Caiu agora: buscar já, sem esperar o primeiro ciclo.
      now();
    } else {
      clear();
    }

    const onVisibility = (): void => {
      if (!visible()) {
        clear();

        return;
      }

      now();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', now);
    window.addEventListener('focus', now);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', now);
      window.removeEventListener('focus', now);
      clear();
    };
  }, [realtime, hasSession, clear, run, intervalMs]);

  const syncNow = useCallback(() => {
    void run(() => undefined);
  }, [run]);

  return { syncing, lastSyncAt, delayMs, syncNow };
}
