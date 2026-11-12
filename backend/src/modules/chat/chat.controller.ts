import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SuccessDto } from '../../common/dto/api-error.dto';
import { ApiPagedResponse } from '../../common/swagger/api-paged-response.decorator';
import { ApiWorkspaceParam } from '../../common/swagger/api-workspace-param.decorator';
import { Types } from 'mongoose';
import { CursorPage } from '../../common/pagination/cursor';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { permissionContextFrom } from '../hierarchy/permission.service';
import {
  CurrentMembership,
  CurrentWorkspace,
} from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import { WorkspaceDocument } from '../workspaces/schemas/workspace.schema';
import { ChannelsService, ChatActivity } from './channels.service';
import { MessageToTaskResult, MessagesService } from './messages.service';
import {
  ChannelMembersDto,
  ChannelQueryDto,
  CreateChannelDto,
  CreateDmDto,
  UpdateChannelDto,
} from './dto/channel.dto';
import { ChannelReadDto, ChatActivityDto, MessageToTaskResultDto } from './dto/chat-result.dto';
import {
  CreateMessageDto,
  MessageReactionDto,
  MessageToTaskDto,
  UpdateMessageDto,
} from './dto/message.dto';
import { Channel, ChannelDocument } from './schemas/channel.schema';
import { Message, MessageDocument } from './schemas/message.schema';

@ApiTags('chat')
@ApiBearerAuth()
@ApiWorkspaceParam()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/channels')
export class ChannelsController {
  constructor(
    private readonly channels: ChannelsService,
    private readonly messages: MessagesService,
  ) {}

  @Post()
  @ApiCreatedResponse({ description: 'Canal criado.', type: Channel })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateChannelDto,
  ): Promise<ChannelDocument> {
    return this.channels.create(permissionContextFrom(membership), dto);
  }

  @Get()
  @ApiPagedResponse(Channel, 'Canais visíveis, mais novos primeiro.')
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: ChannelQueryDto,
  ): Promise<CursorPage<ChannelDocument>> {
    return this.channels.list(permissionContextFrom(membership), query);
  }

  @Post('dm')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'Conversa direta do par, criada se ainda não existir.',
    type: Channel,
  })
  dm(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateDmDto,
  ): Promise<ChannelDocument> {
    return this.channels.getOrCreateDm(permissionContextFrom(membership), dto);
  }

  @Get(':channelId')
  @ApiOkResponse({ description: 'Canal.', type: Channel })
  get(
    @CurrentMembership() membership: RequestMembership,
    @Param('channelId', ParseObjectIdPipe) channelId: Types.ObjectId,
  ): Promise<ChannelDocument> {
    return this.channels.get(permissionContextFrom(membership), channelId);
  }

  @Patch(':channelId')
  @ApiOkResponse({ description: 'Canal atualizado.', type: Channel })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('channelId', ParseObjectIdPipe) channelId: Types.ObjectId,
    @Body() dto: UpdateChannelDto,
  ): Promise<ChannelDocument> {
    return this.channels.update(permissionContextFrom(membership), channelId, dto);
  }

  @Delete(':channelId')
  @ApiOkResponse({ description: 'Canal arquivado.', type: SuccessDto })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('channelId', ParseObjectIdPipe) channelId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.channels.setArchived(permissionContextFrom(membership), channelId, true);

    return { success: true };
  }

  @Post(':channelId/unarchive')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Canal desarquivado.', type: Channel })
  unarchive(
    @CurrentMembership() membership: RequestMembership,
    @Param('channelId', ParseObjectIdPipe) channelId: Types.ObjectId,
  ): Promise<ChannelDocument> {
    return this.channels.setArchived(permissionContextFrom(membership), channelId, false);
  }

  @Post(':channelId/join')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Entrou no canal.', type: Channel })
  join(
    @CurrentMembership() membership: RequestMembership,
    @Param('channelId', ParseObjectIdPipe) channelId: Types.ObjectId,
  ): Promise<ChannelDocument> {
    return this.channels.join(permissionContextFrom(membership), channelId);
  }

  @Post(':channelId/leave')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Saiu do canal.', type: Channel })
  leave(
    @CurrentMembership() membership: RequestMembership,
    @Param('channelId', ParseObjectIdPipe) channelId: Types.ObjectId,
  ): Promise<ChannelDocument> {
    return this.channels.leave(permissionContextFrom(membership), channelId);
  }

  @Post(':channelId/members')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Participantes adicionados.', type: Channel })
  addMembers(
    @CurrentMembership() membership: RequestMembership,
    @Param('channelId', ParseObjectIdPipe) channelId: Types.ObjectId,
    @Body() dto: ChannelMembersDto,
  ): Promise<ChannelDocument> {
    return this.channels.addMembers(permissionContextFrom(membership), channelId, dto);
  }

  @Delete(':channelId/members/:userId')
  @ApiOkResponse({ description: 'Participante removido.', type: Channel })
  removeMember(
    @CurrentMembership() membership: RequestMembership,
    @Param('channelId', ParseObjectIdPipe) channelId: Types.ObjectId,
    @Param('userId', ParseObjectIdPipe) userId: Types.ObjectId,
  ): Promise<ChannelDocument> {
    return this.channels.removeMember(permissionContextFrom(membership), channelId, userId);
  }

  @Post(':channelId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Canal marcado como lido.', type: ChannelReadDto })
  async read(
    @CurrentMembership() membership: RequestMembership,
    @Param('channelId', ParseObjectIdPipe) channelId: Types.ObjectId,
  ): Promise<{ channelId: string; lastReadAt: string }> {
    const read = await this.channels.markRead(permissionContextFrom(membership), channelId);

    return { channelId: String(read.channelId), lastReadAt: read.lastReadAt.toISOString() };
  }

  @Post(':channelId/messages')
  @ApiCreatedResponse({ description: 'Mensagem enviada.', type: Message })
  send(
    @CurrentMembership() membership: RequestMembership,
    @Param('channelId', ParseObjectIdPipe) channelId: Types.ObjectId,
    @Body() dto: CreateMessageDto,
  ): Promise<MessageDocument> {
    return this.messages.create(permissionContextFrom(membership), channelId, dto);
  }

  @Get(':channelId/messages')
  @ApiPagedResponse(Message, 'Mensagens do canal, mais novas primeiro.')
  listMessages(
    @CurrentMembership() membership: RequestMembership,
    @Param('channelId', ParseObjectIdPipe) channelId: Types.ObjectId,
    @Query() query: PaginationQueryDto,
  ): Promise<CursorPage<MessageDocument>> {
    return this.messages.list(permissionContextFrom(membership), channelId, query);
  }
}

@ApiTags('chat')
@ApiBearerAuth()
@ApiWorkspaceParam()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Patch(':messageId')
  @ApiOkResponse({ description: 'Mensagem editada.', type: Message })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('messageId', ParseObjectIdPipe) messageId: Types.ObjectId,
    @Body() dto: UpdateMessageDto,
  ): Promise<MessageDocument> {
    return this.messages.update(permissionContextFrom(membership), messageId, dto);
  }

  @Delete(':messageId')
  @ApiOkResponse({ description: 'Mensagem excluída.', type: SuccessDto })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('messageId', ParseObjectIdPipe) messageId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.messages.remove(permissionContextFrom(membership), messageId);

    return { success: true };
  }

  @Post(':messageId/reactions')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Reação alternada.', type: Message })
  react(
    @CurrentMembership() membership: RequestMembership,
    @Param('messageId', ParseObjectIdPipe) messageId: Types.ObjectId,
    @Body() dto: MessageReactionDto,
  ): Promise<MessageDocument> {
    return this.messages.react(permissionContextFrom(membership), messageId, dto);
  }

  @Get(':messageId/replies')
  @ApiPagedResponse(Message, 'Respostas da thread, mais antigas primeiro.')
  replies(
    @CurrentMembership() membership: RequestMembership,
    @Param('messageId', ParseObjectIdPipe) messageId: Types.ObjectId,
    @Query() query: PaginationQueryDto,
  ): Promise<CursorPage<MessageDocument>> {
    return this.messages.listReplies(permissionContextFrom(membership), messageId, query);
  }

  @Post(':messageId/to-task')
  @ApiCreatedResponse({
    description: 'Tarefa criada a partir da mensagem.',
    type: MessageToTaskResultDto,
  })
  toTask(
    @CurrentMembership() membership: RequestMembership,
    @CurrentWorkspace() workspace: WorkspaceDocument,
    @Param('messageId', ParseObjectIdPipe) messageId: Types.ObjectId,
    @Body() dto: MessageToTaskDto,
  ): Promise<MessageToTaskResult> {
    return this.messages.toTask(
      permissionContextFrom(membership),
      messageId,
      workspace.taskPrefix,
      dto,
    );
  }
}

@ApiTags('chat')
@ApiBearerAuth()
@ApiWorkspaceParam()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/me/chat-activity')
export class ChatActivityController {
  constructor(private readonly channels: ChannelsService) {}

  @Get()
  @ApiOkResponse({
    description: 'Não lidas por canal, para a Sidebar Home.',
    type: ChatActivityDto,
  })
  activity(@CurrentMembership() membership: RequestMembership): Promise<ChatActivity> {
    return this.channels.activity(permissionContextFrom(membership));
  }
}
