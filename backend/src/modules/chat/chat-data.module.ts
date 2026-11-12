import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { ChatAccessService } from './chat-access.service';
import { Channel, ChannelSchema } from './schemas/channel.schema';
import { ChannelRead, ChannelReadSchema } from './schemas/channel-read.schema';
import { Message, MessageSchema } from './schemas/message.schema';

/**
 * Collections of the chat module. Separate from ChatModule so the search and the
 * realtime gateway can read a channel without a circular dependency.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Channel.name, schema: ChannelSchema },
      { name: Message.name, schema: MessageSchema },
      { name: ChannelRead.name, schema: ChannelReadSchema },
    ]),
    HierarchyModule,
  ],
  providers: [ChatAccessService],
  exports: [MongooseModule, ChatAccessService],
})
export class ChatDataModule {}
