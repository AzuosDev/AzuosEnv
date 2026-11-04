import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RoomAccessService } from './room-access.service';
import { RoomAck, RoomPayload, TypingPayload, userRoom } from './realtime-rooms';

const TASK_ROOM_PREFIX = 'task:';
const CHANNEL_ROOM_PREFIX = 'channel:';

interface SocketData {
  userId: string;
  /** Task rooms of this socket, so presence can be refreshed on disconnect. */
  taskRooms: Set<string>;
}

/**
 * Socket.IO gateway on /ws. The handshake carries `auth.token` (access token) and
 * every room join is checked against the same permissions as the HTTP API.
 */
@WebSocketGateway({ path: '/ws', cors: { origin: true, credentials: true } })
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  private server?: Server;

  constructor(private readonly rooms: RoomAccessService) {}

  afterInit(server: Server): void {
    server.use((socket, next) => {
      void this.rooms
        .authenticate(socket.handshake.auth?.token)
        .then((userId) => {
          dataOf(socket).userId = userId;
          next();
        })
        .catch(() => next(new Error('UNAUTHORIZED')));
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    await client.join(userRoom(dataOf(client).userId));
  }

  async handleDisconnect(client: Socket): Promise<void> {
    for (const room of dataOf(client).taskRooms) {
      await this.broadcastPresence(room);
    }
  }

  @SubscribeMessage('join')
  async join(client: Socket, payload: RoomPayload): Promise<RoomAck> {
    const room = await this.resolve(client, payload);

    if (typeof room !== 'string') {
      return room;
    }

    await client.join(room);

    if (room.startsWith(TASK_ROOM_PREFIX)) {
      dataOf(client).taskRooms.add(room);
      await this.broadcastPresence(room);
    }

    return { joined: room };
  }

  @SubscribeMessage('leave')
  async leave(client: Socket, payload: RoomPayload): Promise<RoomAck> {
    const room = await this.resolve(client, payload);

    if (typeof room !== 'string') {
      return room;
    }

    await client.leave(room);

    if (dataOf(client).taskRooms.delete(room)) {
      await this.broadcastPresence(room);
    }

    return { left: room };
  }

  /**
   * Ephemeral typing signal of a channel: it is only relayed to the other clients
   * of the room, never stored.
   */
  @SubscribeMessage('typing')
  async typing(client: Socket, payload: TypingPayload): Promise<RoomAck> {
    const room = await this.resolve(client, payload);

    if (typeof room !== 'string') {
      return room;
    }

    if (!room.startsWith(CHANNEL_ROOM_PREFIX)) {
      return { code: 'FORBIDDEN_ROOM' };
    }

    client.to(room).emit('typing', {
      channelId: room.slice(CHANNEL_ROOM_PREFIX.length),
      userId: dataOf(client).userId,
      typing: payload?.typing !== false,
    });

    return { joined: room };
  }

  /** Pushes a domain event to every room that should see it. */
  emitToRooms(rooms: string[], event: string, payload: Record<string, unknown>): void {
    const unique = [...new Set(rooms)];

    if (!this.server || unique.length === 0) {
      return;
    }

    this.server.to(unique).emit(event, payload);
  }

  /** Who is currently watching the task room. */
  private async broadcastPresence(room: string): Promise<void> {
    if (!this.server) {
      return;
    }

    const sockets = await this.server.in(room).fetchSockets();
    const userIds = [...new Set(sockets.map((socket) => String(dataOf(socket).userId)))];

    this.server.to(room).emit('presence:update', {
      taskId: room.slice(TASK_ROOM_PREFIX.length),
      userIds,
    });
  }

  /** The global exception filter only handles HTTP, so errors answer the ack. */
  private async resolve(client: Socket, payload: RoomPayload): Promise<string | RoomAck> {
    try {
      return await this.rooms.resolve(dataOf(client).userId, payload ?? {});
    } catch (error) {
      this.logger.debug(`Sala negada: ${error instanceof Error ? error.message : String(error)}`);

      return { code: 'FORBIDDEN_ROOM' };
    }
  }
}

function dataOf(socket: { data: Partial<SocketData> }): SocketData {
  socket.data.taskRooms ??= new Set<string>();
  socket.data.userId ??= '';

  return socket.data as SocketData;
}
