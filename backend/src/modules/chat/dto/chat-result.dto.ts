import { ApiProperty } from '@nestjs/swagger';
import { Task } from '../../tasks/schemas/task.schema';
import { CHANNEL_TYPES, ChannelType } from '../chat-fields';

/** Answer of POST /channels/:channelId/read. */
export class ChannelReadDto {
  @ApiProperty()
  channelId: string;

  @ApiProperty({ format: 'date-time' })
  lastReadAt: string;
}

/** One participant's delivery and read watermarks for a channel. */
export class ChannelReaderDto {
  @ApiProperty()
  userId: string;

  @ApiProperty({ format: 'date-time', nullable: true })
  lastReadAt: string | null;

  @ApiProperty({ format: 'date-time', nullable: true })
  lastDeliveredAt: string | null;
}

/** Answer of GET /channels/:channelId/reads. */
export class ChannelReadsDto {
  @ApiProperty({ type: [ChannelReaderDto] })
  items: ChannelReaderDto[];
}

/** One line of the chat activity of the Sidebar Home. */
export class ChannelActivityDto {
  @ApiProperty()
  channelId: string;

  @ApiProperty({ enum: CHANNEL_TYPES })
  type: ChannelType;

  @ApiProperty({ example: 'usolutionspdv' })
  name: string;

  @ApiProperty({ example: 3 })
  unread: number;

  @ApiProperty({ format: 'date-time', nullable: true })
  lastMessageAt: string | null;

  @ApiProperty({ format: 'date-time', nullable: true })
  lastReadAt: string | null;
}

export class ChatActivityDto {
  @ApiProperty({ type: [ChannelActivityDto] })
  items: ChannelActivityDto[];

  @ApiProperty({ description: 'Soma das não lidas de todos os canais visíveis.' })
  unread: number;
}

/** Answer of POST /messages/:messageId/to-task. */
export class MessageToTaskResultDto {
  @ApiProperty({ type: Task })
  task: Task;

  @ApiProperty({ description: 'Link direto da mensagem que originou a tarefa.' })
  messageUrl: string;
}
