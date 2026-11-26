import { API_BASE_URL } from '@/api/client';
import type { paths } from '@/api/schema';
import { getAccessToken } from '@/api/token-store';

/** Salas que o servidor aceita; a do usuário é assinada sozinha. */
export type RoomKind = 'ws' | 'list' | 'task' | 'doc' | 'channel' | 'board' | 'whatsapp';

export type Transport = 'socket.io' | 'ably';

type TokenBody =
  paths['/api/v1/realtime/token']['post']['responses']['200']['content']['application/json'];

/**
 * Canais que existem fora do processo do servidor. No Ably só eles chegam ao
 * navegador; evento de tarefa, doc ou quadro viaja na sala do workspace, que
 * toda aba assina.
 */
const REMOTE_KINDS: RoomKind[] = ['ws', 'channel'];

export interface RealtimeCredential {
  transport: Transport;
  /** Pedido de token do Ably; nulo no transporte socket.io. */
  token: Record<string, unknown> | null;
  channels: string[];
}

/**
 * Credencial desta aba: diz o transporte e, no Ably, o token recortado.
 *
 * Vai por fetch próprio, **fora** do cliente tipado, e nunca renova sessão.
 * Dois motivos: no cliente tipado um 401 que não se resolve declara a sessão
 * perdida e manda para o login, e pedir `/auth/refresh` daqui competiria com a
 * renovação do app — refresh token é rotativo, então duas chamadas ao mesmo
 * tempo invalidam a sessão de quem está trabalhando. Tempo real é acessório: se
 * a credencial não vier, quem chamou tenta de novo mais tarde, já com o token
 * que o app renovou. O tipo continua vindo do contrato gerado.
 */
export async function fetchCredential(): Promise<RealtimeCredential> {
  const body = await requestCredential(getAccessToken());

  if (!body) {
    throw new Error('sem credencial de tempo real');
  }

  return toCredential(body);
}

/** Null quando a resposta não serve (401, erro de rede, corpo estranho). */
async function requestCredential(token: string | null): Promise<TokenBody | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/realtime/token`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as TokenBody;
  } catch {
    return null;
  }
}

function toCredential(body: TokenBody): RealtimeCredential {
  return {
    transport: body.transport as Transport,
    token: body.token,
    channels: body.channels,
  };
}

export function channelName(kind: RoomKind, id: string): string {
  return `${kind}:${id}`;
}

export function userChannel(userId: string): string {
  return `user:${userId}`;
}

/** A sala tem canal próprio fora do servidor. */
export function isRemoteRoom(kind: RoomKind): boolean {
  return REMOTE_KINDS.includes(kind);
}

export type EventHandler = (payload: unknown) => void;

/**
 * Despacha o evento do transporte para quem o assinou por nome, para o
 * consumidor não saber de onde a mensagem veio.
 */
export class EventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();

  on(event: string, handler: EventHandler): () => void {
    const set = this.handlers.get(event) ?? new Set<EventHandler>();

    set.add(handler);
    this.handlers.set(event, set);

    return () => {
      set.delete(handler);

      if (set.size === 0) {
        this.handlers.delete(event);
      }
    };
  }

  /** Nomes assinados agora: o Socket.IO precisa ouvir cada um. */
  events(): string[] {
    return [...this.handlers.keys()];
  }

  dispatch(event: string, payload: unknown): void {
    for (const handler of this.handlers.get(event) ?? []) {
      handler(payload);
    }
  }
}
