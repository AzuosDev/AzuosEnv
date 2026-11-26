import {
  createContext,
  useCallback,
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
import {
  EventBus,
  channelName,
  fetchCredential,
  isRemoteRoom,
  userChannel,
  type EventHandler,
  type RoomKind,
  type Transport,
} from './transport';

export const SOCKET_PATH = '/ws';

export interface RealtimeState {
  /** Transporte em uso; nulo enquanto a credencial não chegou. */
  transport: Transport | null;
  connected: boolean;
  /**
   * Socket.IO cru, só no transporte socket.io: o que o cliente manda para o
   * servidor (digitação, operações do quadro) passa por ele.
   */
  socket: Socket | null;
  /** Entra na sala enquanto alguém a usa; o retorno sai dela. */
  join: (kind: RoomKind, id: string, wsId?: string) => () => void;
  on: (event: string, handler: EventHandler) => () => void;
}

const RealtimeContext = createContext<RealtimeState>({
  transport: null,
  connected: false,
  socket: null,
  join: () => () => undefined,
  on: () => () => undefined,
});

/** Motor de um transporte: o provider troca de motor sem o resto saber. */
interface Engine {
  transport: Transport;
  socket: Socket | null;
  join: (kind: RoomKind, id: string, wsId?: string) => () => void;
  close: () => void;
}

interface Room {
  kind: RoomKind;
  id: string;
  wsId?: string;
}

/**
 * Conexão de tempo real da aba, montada logo depois do login. Uma só por aba: a
 * sala do usuário e a do workspace ficam assinadas o tempo todo, e a sala de um
 * canal só enquanto a conversa está aberta.
 *
 * O transporte vem do servidor (`POST /realtime/token`): em host de processo
 * longo é o gateway Socket.IO; em serverless é o Ably, porque a Function não
 * mantém conexão aberta — era por isso que nada chegava em produção.
 */
export function RealtimeProvider({
  userId,
  children,
}: {
  userId: string | undefined;
  children: ReactNode;
}) {
  const [transport, setTransport] = useState<Transport | null>(null);
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const bus = useRef(new EventBus());
  const engine = useRef<Engine | null>(null);

  useEffect(() => {
    if (!userId) {
      return;
    }

    let alive = true;

    const start = async (): Promise<void> => {
      const credential = await credentialWithRetry(() => alive);

      if (!alive) {
        return;
      }

      const built =
        credential.transport === 'ably'
          ? await createAblyEngine({ userId, bus: bus.current, onConnected: setConnected })
          : createSocketEngine({
              bus: bus.current,
              onConnected: setConnected,
              onSocket: setSocket,
            });

      if (!alive) {
        built.close();

        return;
      }

      engine.current = built;
      // Quem assina sala depende de `transport`, então o efeito de cada tela
      // roda de novo aqui e entra na sala com o motor já de pé.
      setTransport(built.transport);
    };

    void start().catch(() => {
      // Sem credencial a aba fica sem tempo real; a reserva por busca assume.
      setTransport(null);
      setConnected(false);
    });

    return () => {
      alive = false;
      engine.current?.close();
      engine.current = null;
      setTransport(null);
      setConnected(false);
      setSocket(null);
    };
  }, [userId]);

  const join = useCallback(
    (kind: RoomKind, id: string, wsId?: string) =>
      engine.current?.join(kind, id, wsId) ?? (() => undefined),
    [],
  );

  const on = useCallback(
    (event: string, handler: EventHandler) => bus.current.on(event, handler),
    [],
  );

  const value = useMemo<RealtimeState>(
    () => ({ transport, connected, socket, join, on }),
    [transport, connected, socket, join, on],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeState {
  return useContext(RealtimeContext);
}

/** Compatibilidade com quem só precisa do socket cru e do estado da conexão. */
export function useSocket(): Pick<RealtimeState, 'socket' | 'connected'> {
  const { socket, connected } = useRealtime();

  return { socket, connected };
}

/**
 * Assina um evento do servidor enquanto o componente existe, qualquer que seja
 * o transporte. O handler pode mudar a cada render sem reassinar.
 */
export function useRealtimeEvent<T>(event: string, handler: (payload: T) => void): void {
  const { on } = useRealtime();
  const latest = useRef(handler);

  useEffect(() => {
    latest.current = handler;
  }, [handler]);

  useEffect(() => on(event, (payload) => latest.current(payload as T)), [on, event]);
}

/** Entra na sala enquanto o componente existe. */
export function useRealtimeRoom(kind: RoomKind, id: string, wsId?: string): void {
  const { join, transport } = useRealtime();

  useEffect(() => {
    if (!transport || id === '') {
      return;
    }

    return join(kind, id, wsId);
  }, [join, transport, kind, id, wsId]);
}

/** Nome antigo do assinante de evento, mantido para as telas já escritas. */
export const useSocketEvent = useRealtimeEvent;

/** Esperas entre as tentativas de pegar a credencial, em ms. */
const CREDENTIAL_BACKOFF = [1_000, 3_000, 8_000];

/**
 * Credencial com algumas tentativas: a primeira pode cair numa janela em que a
 * sessão ainda está sendo restaurada, e perder o tempo real da aba inteira por
 * causa disso seria caro demais.
 */
async function credentialWithRetry(alive: () => boolean) {
  let last: unknown = null;

  for (const wait of [0, ...CREDENTIAL_BACKOFF]) {
    if (!alive()) {
      throw new Error('aba saiu antes da credencial');
    }

    if (wait > 0) {
      await new Promise((resolve) => {
        window.setTimeout(resolve, wait);
      });
    }

    try {
      return await fetchCredential();
    } catch (error) {
      last = error;
    }
  }

  throw last instanceof Error ? last : new Error('sem credencial de tempo real');
}

/* Motores ---------------------------------------------------------------- */

interface EngineOptions {
  bus: EventBus;
  onConnected: (connected: boolean) => void;
}

/**
 * Gateway Socket.IO deste servidor. O access token vai no handshake, o token
 * expirado dispara uma renovação e uma reconexão, e cada evento assinado no
 * barramento vira um ouvinte no cliente.
 */
function createSocketEngine({
  bus,
  onConnected,
  onSocket,
}: EngineOptions & { onSocket: (socket: Socket | null) => void }): Engine {
  const client = io(API_BASE_URL, {
    path: SOCKET_PATH,
    transports: ['websocket'],
    auth: { token: getAccessToken() },
    withCredentials: true,
  });
  const rooms = new Map<string, Room & { count: number }>();
  const listening = new Set<string>();
  let refreshing = false;
  let refreshed = false;

  const listen = (): void => {
    for (const event of bus.events()) {
      if (listening.has(event)) {
        continue;
      }

      listening.add(event);
      client.on(event, (payload: unknown) => bus.dispatch(event, payload));
    }
  };

  const onConnect = (): void => {
    refreshed = false;
    onConnected(true);
    listen();

    for (const room of rooms.values()) {
      client.emit('join', { room: room.kind, id: room.id, wsId: room.wsId });
    }
  };

  /** O token morreu: uma renovação e uma reconexão, nunca em laço. */
  const onConnectError = (): void => {
    onConnected(false);

    if (refreshing || refreshed || client.active) {
      return;
    }

    refreshing = true;
    refreshed = true;

    void requestRefresh()
      .then((session) => {
        if (!session) {
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
  client.on('disconnect', () => onConnected(false));
  client.on('connect_error', onConnectError);
  onSocket(client);

  return {
    transport: 'socket.io',
    socket: client,
    join: (kind, id, wsId) => {
      const key = `${kind}:${id}`;
      const current = rooms.get(key);

      rooms.set(key, { kind, id, wsId, count: (current?.count ?? 0) + 1 });
      listen();

      if (client.connected) {
        client.emit('join', { room: kind, id, wsId });
      }

      return () => {
        const room = rooms.get(key);

        if (!room) {
          return;
        }

        // Duas telas na mesma sala: só a última a fecha.
        if (room.count > 1) {
          rooms.set(key, { ...room, count: room.count - 1 });

          return;
        }

        rooms.delete(key);

        if (client.connected) {
          client.emit('leave', { room: kind, id, wsId });
        }
      };
    },
    close: () => {
      client.removeAllListeners();
      client.disconnect();
      onSocket(null);
    },
  };
}

/**
 * Ably: a conexão vive no serviço, então funciona com a API em serverless. O
 * token sai do nosso servidor já recortado nos canais do usuário, e o SDK entra
 * por import dinâmico para não pesar o bundle de quem usa Socket.IO.
 */
async function createAblyEngine({
  userId,
  bus,
  onConnected,
}: EngineOptions & { userId: string }): Promise<Engine> {
  const { Realtime } = await import('ably');
  const client = new Realtime({
    clientId: userId,
    // Cada renovação pede outro token: a permissão é recalculada no servidor.
    authCallback: (_params, callback) => {
      void fetchCredential()
        .then((credential) => {
          if (!credential.token) {
            callback('sem token de tempo real', null);

            return;
          }

          callback(null, credential.token as never);
        })
        .catch((error: unknown) => {
          callback(error instanceof Error ? error.message : String(error), null);
        });
    },
  });
  const subscribed = new Map<string, number>();

  client.connection.on('connected', () => onConnected(true));
  client.connection.on('disconnected', () => onConnected(false));
  client.connection.on('suspended', () => onConnected(false));
  client.connection.on('failed', () => onConnected(false));

  /** Um canal entrega vários eventos; o barramento separa por nome. */
  const attach = (name: string): void => {
    const count = subscribed.get(name) ?? 0;

    subscribed.set(name, count + 1);

    if (count > 0) {
      return;
    }

    void client.channels
      .get(name)
      .subscribe((message) => {
        bus.dispatch(message.name ?? '', message.data);
      })
      .catch(() => {
        // Canal fora da permissão do token: nada a assinar.
      });
  };

  const detach = (name: string): void => {
    const count = subscribed.get(name) ?? 0;

    if (count > 1) {
      subscribed.set(name, count - 1);

      return;
    }

    subscribed.delete(name);
    client.channels.get(name).unsubscribe();
    void client.channels.get(name).detach();
  };

  // A sala do usuário acompanha a aba inteira: notificação e resumo do chat.
  attach(userChannel(userId));

  return {
    transport: 'ably',
    socket: null,
    join: (kind, id) => {
      // Tarefa, List, Doc e quadro não têm canal próprio aqui: os eventos deles
      // viajam na sala do workspace, que a aba já assina.
      if (!isRemoteRoom(kind)) {
        return () => undefined;
      }

      const name = channelName(kind, id);

      attach(name);

      return () => {
        detach(name);
      };
    },
    close: () => {
      client.close();
    },
  };
}
