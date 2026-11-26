import { Injectable } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { RealtimeService, RealtimeTransport } from './realtime.service';

/**
 * Tempo real pelo gateway Socket.IO deste processo. Vale em host de processo
 * longo (Docker, Railway); em serverless o gateway não recebe conexão.
 */
@Injectable()
export class SocketIoRealtime extends RealtimeService {
  readonly transport: RealtimeTransport = 'socket.io';

  constructor(private readonly gateway: EventsGateway) {
    super();
  }

  publish(channels: string[], event: string, data: Record<string, unknown>): Promise<void> {
    // O gateway entrega em memória: nada para esperar, e ele já ignora sala vazia.
    this.gateway.emitToRooms(channels, event, data);

    return Promise.resolve();
  }
}
