import { Module } from '@nestjs/common';
import { CollaborationDataModule } from '../collaboration/collaboration-data.module';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { TasksModule } from '../tasks/tasks.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ChannelsService } from './channels.service';
import { ChatDataModule } from './chat-data.module';
import { ChannelsController, ChatActivityController, MessagesController } from './chat.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [
    ChatDataModule,
    HierarchyModule,
    WorkspacesModule,
    TasksModule,
    CollaborationDataModule,
  ],
  controllers: [ChannelsController, MessagesController, ChatActivityController],
  providers: [ChannelsService, MessagesService],
  exports: [ChannelsService, MessagesService],
})
export class ChatModule {}
