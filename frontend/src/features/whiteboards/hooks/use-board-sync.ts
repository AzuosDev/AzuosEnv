import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiRequestError } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { Whiteboard } from '@/api/types';
import { useSession } from '@/features/auth/session';
import { useSocket, useSocketEvent } from '@/features/realtime/socket';
import { patchElements, whiteboardQuery } from '../api';
import {
  diffElements,
  liveElements,
  mergeOps,
  toBoardElement,
  toCanvasElements,
  type BoardElement,
  type BoardOp,
  type CanvasElement,
} from '../elements';

/** Quanto o canvas fica parado antes de o lote ir para o servidor. */
const DEBOUNCE_MS = 700;

export type BoardSaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface BoardScene {
  elements: CanvasElement[];
  /** Sobe a cada carga de fora; o canvas aplica a cena quando muda. */
  epoch: number;
}

export interface BoardSync {
  state: BoardSaveState;
  scene: BoardScene;
  /** Avisa que o canvas mudou; o lote vai sozinho depois da pausa. */
  queue: (elements: readonly CanvasElement[]) => void;
}

function serverElements(board: Whiteboard): BoardElement[] {
  return board.elements.filter(
    (element): element is BoardElement =>
      typeof element === 'object' &&
      element !== null &&
      typeof (element as BoardElement).id === 'string',
  );
}

interface BoardEvent {
  whiteboardId?: string;
  actorId?: string;
  version?: number;
}

/**
 * Salvamento e sincronia do quadro: o canvas manda a lista inteira, o hook
 * descobre o lote, manda com `version` e, no 409, recarrega o quadro e
 * reaplica o que estava pendente. O que outra pessoa salva chega pela sala
 * board:{id} e entra na cena.
 */
export function useBoardSync(wsId: string, board: Whiteboard | undefined): BoardSync {
  const client = useQueryClient();
  const user = useSession();
  const { socket, connected } = useSocket();
  const [state, setState] = useState<BoardSaveState>('idle');
  const [scene, setScene] = useState<BoardScene>({ elements: [], epoch: 0 });
  const synced = useRef<BoardElement[]>([]);
  const version = useRef(1);
  const pending = useRef<BoardOp[]>([]);
  const sending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boardId = board?.id;

  /** Primeira carga do quadro aberto: a cena nasce do servidor. */
  useEffect(() => {
    if (!board) {
      return;
    }

    synced.current = serverElements(board);
    version.current = board.version;
    pending.current = [];
    setScene({ elements: toCanvasElements(board.elements), epoch: 1 });
    // Só na troca de quadro: o salvamento seguinte não remonta a cena.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const adopt = useCallback((fresh: Whiteboard, toScene: boolean): void => {
    synced.current = serverElements(fresh);
    version.current = fresh.version;

    if (toScene) {
      setScene((previous) => ({
        elements: toCanvasElements(fresh.elements),
        epoch: previous.epoch + 1,
      }));
    }
  }, []);

  const reload = useCallback(async (): Promise<Whiteboard | null> => {
    if (boardId === undefined) {
      return null;
    }

    try {
      const fresh = await client.fetchQuery({ ...whiteboardQuery(wsId, boardId), staleTime: 0 });

      client.setQueryData(queryKeys.whiteboard(wsId, boardId), fresh);

      return fresh;
    } catch {
      return null;
    }
  }, [boardId, client, wsId]);

  const flush = useCallback(async (): Promise<void> => {
    if (boardId === undefined || sending.current) {
      return;
    }

    sending.current = true;

    try {
      // Cada volta manda o que está pendente; o 409 recarrega e tenta de novo.
      for (let attempt = 0; attempt < 3 && pending.current.length > 0; attempt += 1) {
        const ops = pending.current;

        pending.current = [];
        setState('saving');

        try {
          const saved = await patchElements(wsId, boardId, version.current, ops);

          adopt(saved, false);
          client.setQueryData(queryKeys.whiteboard(wsId, boardId), saved);
          setState('saved');
        } catch (error) {
          const conflict =
            error instanceof ApiRequestError && error.code === 'WHITEBOARD_VERSION_CONFLICT';
          const fresh = conflict ? await reload() : null;

          pending.current = mergeOps(ops, pending.current);

          if (fresh) {
            adopt(fresh, true);
            continue;
          }

          setState('error');
          break;
        }
      }
    } finally {
      sending.current = false;
    }
  }, [adopt, boardId, client, reload, wsId]);

  const queue = useCallback(
    (elements: readonly CanvasElement[]) => {
      const next = liveElements(elements).map(toBoardElement);
      const ops = diffElements(synced.current, next);

      if (ops.length === 0) {
        return;
      }

      synced.current = next;
      pending.current = mergeOps(pending.current, ops);

      if (timer.current) {
        clearTimeout(timer.current);
      }

      timer.current = setTimeout(() => {
        void flush();
      }, DEBOUNCE_MS);
    },
    [flush],
  );

  useEffect(() => {
    if (!socket || !connected || boardId === undefined) {
      return;
    }

    socket.emit('join', { room: 'board', id: boardId });

    return () => {
      socket.emit('leave', { room: 'board', id: boardId });
    };
  }, [socket, connected, boardId]);

  useSocketEvent<BoardEvent>('whiteboard.updated', (payload) => {
    if (payload.whiteboardId !== boardId || payload.actorId === user?.id) {
      return;
    }

    if (payload.version !== undefined && payload.version <= version.current) {
      return;
    }

    void reload().then((fresh) => {
      if (fresh) {
        adopt(fresh, true);
      }
    });
  });

  return { state, scene, queue };
}
