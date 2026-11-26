import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { ChatDataModule } from '../chat/chat-data.module';
import { DocsDataModule } from '../docs/docs-data.module';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { TasksModule } from '../tasks/tasks.module';
import { UsersModule } from '../users/users.module';
import { WhatsappDataModule } from '../whatsapp/whatsapp-data.module';
import { WhiteboardsDataModule } from '../whiteboards/whiteboards-data.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AblyRealtime } from './ably.realtime';
import { EventsGateway } from './events.gateway';
import { RealtimeController } from './realtime.controller';
import { RealtimeListener } from './realtime.listener';
import { RealtimeService } from './realtime.service';
import { SocketIoRealtime } from './socket-io.realtime';
import { RoomAccessService } from './room-access.service';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    WorkspacesModule,
    HierarchyModule,
    TasksModule,
    DocsDataModule,
    ChatDataModule,
    WhiteboardsDataModule,
    WhatsappDataModule,
  ],
  controllers: [RealtimeController],
  providers: [
    RoomAccessService,
    EventsGateway,
    RealtimeListener,
    SocketIoRealtime,
    AblyRealtime,
    {
      // Com ABLY_API_KEY o tempo real sai pelo Ably (host serverless); sem ela,
      // pelo gateway Socket.IO deste processo. Uma escolha só, no boot.
      provide: RealtimeService,
      inject: [ConfigService, AblyRealtime, SocketIoRealtime],
      useFactory: (config: ConfigService, ably: AblyRealtime, socket: SocketIoRealtime) =>
        (config.get<string>('ABLY_API_KEY') ?? '') !== '' ? ably : socket,
    },
  ],
  exports: [RealtimeService],
})
export class RealtimeModule {}
