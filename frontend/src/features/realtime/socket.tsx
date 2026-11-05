import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL, requestRefresh } from '@/api/client';
import { getAccessToken, setAccessToken } from '@/api/token-store';

/** Salas que o gateway aceita; a sala do usuário entra sozinha na conexão. */
export type RoomKind = 'ws' | 'list' | 'task' | 'doc' | 'channel' | 'board';

export interface SocketState {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketState>({ socket: null, connected: false });

export const SOCKET_PATH = '/ws';

/**
 * Conexão Socket.IO do workspace: o access token vai no handshake, o token
 * expirado dispara uma renovação e a reconexão, e a sala ws:{wsId} é assinada
 * em cada conexão.
 */
export function SocketProvider({ wsId, children }: { wsId: string; children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const client = io(API_BASE_URL, {
      path: SOCKET_PATH,
      transports: ['websocket'],
      auth: { token: getAccessToken() },
      withCredentials: true,
    });

    let refreshing = false;
    let refreshed = false;
    let alive = true;

    const onConnect = (): void => {
      refreshed = false;
      setConnected(true);
      client.emit('join', { room: 'ws', id: wsId });
    };

    const onDisconnect = (): void => {
      setConnected(false);
    };

    /** O token morreu: uma renovação e uma reconexão, nunca em laço. */
    const onConnectError = (): void => {
      setConnected(false);

      if (refreshing || refreshed || client.active) {
        return;
      }

      refreshing = true;
      refreshed = true;

      void requestRefresh()
        .then((session) => {
          if (!session || !alive) {
            return;
          }

          setAccessToken(session.accessToken);
          client.auth = { token: session.accessToken };
          client.connect();
        })
        .finally(() => {
          refreshing = false;
        });
    };

    client.on('connect', onConnect);
    client.on('disconnect', onDisconnect);
    client.on('connect_error', onConnectError);
    setSocket(client);

    return () => {
      alive = false;
      client.off('connect', onConnect);
      client.off('disconnect', onDisconnect);
      client.off('connect_error', onConnectError);
      client.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [wsId]);

  const value = useMemo<SocketState>(() => ({ socket, connected }), [socket, connected]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket(): SocketState {
  return useContext(SocketContext);
}

/**
 * Assina um evento do servidor enquanto o componente existe. O handler pode
 * mudar a cada render sem reassinar.
 */
export function useSocketEvent<T>(event: string, handler: (payload: T) => void): void {
  const { socket } = useSocket();
  const latest = useRef(handler);

  useEffect(() => {
    latest.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const listener = (payload: T): void => {
      latest.current(payload);
    };

    socket.on(event, listener);

    return () => {
      socket.off(event, listener);
    };
  }, [socket, event]);
}
