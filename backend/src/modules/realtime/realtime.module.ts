import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatDataModule } from '../chat/chat-data.module';
import { DocsDataModule } from '../docs/docs-data.module';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { TasksModule } from '../tasks/tasks.module';
import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { EventsGateway } from './events.gateway';
import { RealtimeListener } from './realtime.listener';
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
  ],
  providers: [RoomAccessService, EventsGateway, RealtimeListener],
})
export class RealtimeModule {}
