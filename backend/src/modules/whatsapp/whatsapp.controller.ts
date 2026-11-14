import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile as UploadedFileParam,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Types } from 'mongoose';
import { SuccessDto } from '../../common/dto/api-error.dto';
import { CursorPage } from '../../common/pagination/cursor';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { ApiPagedResponse } from '../../common/swagger/api-paged-response.decorator';
import { ApiWorkspaceParam } from '../../common/swagger/api-workspace-param.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { Audit } from '../audit/audit.decorator';
import { UploadedFile } from '../collaboration/attachments.service';
import { MAX_UPLOAD_BYTES } from '../collaboration/collaboration-fields';
import { PermissionContext, permissionContextFrom } from '../hierarchy/permission.service';
import { Task } from '../tasks/schemas/task.schema';
import { TaskDocument } from '../tasks/schemas/task.schema';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import {
  WaAccessListDto,
  WaConnectionStatusDto,
  WaMyAccessDto,
  WaTemplateListDto,
} from './dto/whatsapp-result.dto';
import {
  AssignWaConversationDto,
  CreateWaContactDto,
  GrantWaAccessDto,
  SaveWaConnectionDto,
  SendWaMediaDto,
  SendWaTemplateDto,
  SendWaTextDto,
  UpdateWaContactDto,
  WaContactQueryDto,
  WaConversationLeadDto,
  WaConversationQueryDto,
  WaConversationTaskDto,
  WaModeDto,
  WaPriorityDto,
} from './dto/whatsapp.dto';
import { WaContact, WaContactDocument } from './schemas/wa-contact.schema';
import { WaConnectionDocument } from './schemas/wa-connection.schema';
import { WaConversation, WaConversationDocument } from './schemas/wa-conversation.schema';
import { WaMessage, WaMessageDocument } from './schemas/wa-message.schema';
import { WaAccessEntry, WhatsappAccessService } from './whatsapp-access.service';
import { WhatsappBotService } from './whatsapp-bot.service';
import { WhatsappConnectionsService } from './whatsapp-connections.service';
import { WhatsappContactsService } from './whatsapp-contacts.service';
import { WhatsappConversationsService } from './whatsapp-conversations.service';
import { WhatsappMessagesService } from './whatsapp-messages.service';
import { WhatsappTasksService } from './whatsapp-tasks.service';
import { WaTemplate } from './graph/whatsapp-graph.provider';

const UPLOAD_FIELD = 'file';

/** Multipart with a single `file` field, the same shape as the attachments. */
const UploadMedia = (): MethodDecorator =>
  UseInterceptors(
    FileInterceptor(UPLOAD_FIELD, {
      limits: { fileSize: MAX_UPLOAD_BYTES },
      defParamCharset: 'utf8',
    }),
  );

const UploadBody = (): MethodDecorator =>
  ApiBody({
    schema: {
      type: 'object',
      properties: {
        [UPLOAD_FIELD]: { type: 'string', format: 'binary' },
        caption: { type: 'string' },
        replyTo: { type: 'string' },
      },
      required: [UPLOAD_FIELD],
    },
  });

function ctxOf(membership: RequestMembership): PermissionContext {
  return permissionContextFrom(membership);
}

@ApiTags('whatsapp')
@ApiBearerAuth()
@ApiWorkspaceParam()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/whatsapp/access')
export class WhatsappAccessController {
  constructor(private readonly access: WhatsappAccessService) {}

  @Get()
  @ApiOkResponse({ description: 'Membros e o nível de cada um.', type: WaAccessListDto })
  async list(
    @CurrentMembership() membership: RequestMembership,
  ): Promise<{ items: WaAccessEntry[] }> {
    const ctx = ctxOf(membership);

    await this.access.require(ctx, 'gestor');

    return { items: await this.access.list(ctx) };
  }

  @Get('me')
  @ApiOkResponse({ description: 'Nível do usuário atual.', type: WaMyAccessDto })
  async me(@CurrentMembership() membership: RequestMembership): Promise<WaMyAccessDto> {
    return { level: await this.access.levelOf(ctxOf(membership)) };
  }

  @Put(':userId')
  @Audit('whatsapp.access.changed', 'member', 'userId')
  @ApiOkResponse({ description: 'Nível atribuído ao membro.', type: WaAccessListDto })
  async grant(
    @CurrentMembership() membership: RequestMembership,
    @Param('userId', ParseObjectIdPipe) userId: Types.ObjectId,
    @Body() dto: GrantWaAccessDto,
  ): Promise<{ items: WaAccessEntry[] }> {
    const ctx = ctxOf(membership);

    await this.access.require(ctx, 'gestor');
    await this.access.grant(ctx, userId, dto.level);

    return { items: await this.access.list(ctx) };
  }

  @Delete(':userId')
  @Audit('whatsapp.access.changed', 'member', 'userId')
  @ApiOkResponse({ description: 'Acesso removido.', type: SuccessDto })
  async revoke(
    @CurrentMembership() membership: RequestMembership,
    @Param('userId', ParseObjectIdPipe) userId: Types.ObjectId,
  ): Promise<{ success: true }> {
    const ctx = ctxOf(membership);

    await this.access.require(ctx, 'gestor');
    await this.access.revoke(ctx, userId);

    return { success: true };
  }
}

@ApiTags('whatsapp')
@ApiBearerAuth()
@ApiWorkspaceParam()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/whatsapp/connection')
export class WhatsappConnectionController {
  constructor(
    private readonly access: WhatsappAccessService,
    private readonly connections: WhatsappConnectionsService,
  ) {}

  @Put()
  @Audit('whatsapp.connection.saved', 'integration')
  @ApiOkResponse({ description: 'Conexão salva.', type: WaConnectionStatusDto })
  async save(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: SaveWaConnectionDto,
  ): Promise<WaConnectionStatusDto> {
    const ctx = ctxOf(membership);

    await this.access.require(ctx, 'gestor');

    const connection = await this.connections.save(ctx.workspaceId, ctx.userId, dto);

    return { connection, webhookUrl: this.connections.webhookUrl() };
  }

  @Post('test')
  @Audit('whatsapp.connection.tested', 'integration')
  @ApiOkResponse({ description: 'Conexão testada na Graph API.', type: WaConnectionStatusDto })
  async test(@CurrentMembership() membership: RequestMembership): Promise<WaConnectionStatusDto> {
    const ctx = ctxOf(membership);

    await this.access.require(ctx, 'gestor');

    const connection: WaConnectionDocument = await this.connections.test(ctx.workspaceId);

    return { connection, webhookUrl: this.connections.webhookUrl() };
  }

  @Get()
  @ApiOkResponse({ description: 'Status da conexão.', type: WaConnectionStatusDto })
  async status(@CurrentMembership() membership: RequestMembership): Promise<WaConnectionStatusDto> {
    const ctx = ctxOf(membership);

    await this.access.require(ctx, 'atendente');

    return this.connections.status(ctx.workspaceId);
  }
}

@ApiTags('whatsapp')
@ApiBearerAuth()
@ApiWorkspaceParam()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/whatsapp/templates')
export class WhatsappTemplatesController {
  constructor(
    private readonly access: WhatsappAccessService,
    private readonly messages: WhatsappMessagesService,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'Templates aprovados no WABA.', type: WaTemplateListDto })
  async list(@CurrentMembership() membership: RequestMembership): Promise<{ items: WaTemplate[] }> {
    const ctx = ctxOf(membership);

    await this.access.require(ctx, 'atendente');

    return { items: await this.messages.templates(ctx.workspaceId) };
  }
}

@ApiTags('whatsapp')
@ApiBearerAuth()
@ApiWorkspaceParam()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/whatsapp/conversations')
export class WhatsappConversationsController {
  constructor(
    private readonly access: WhatsappAccessService,
    private readonly conversations: WhatsappConversationsService,
    private readonly messages: WhatsappMessagesService,
    private readonly tasks: WhatsappTasksService,
    private readonly bot: WhatsappBotService,
  ) {}

  @Get()
  @ApiPagedResponse(WaConversation, 'Conversas do filtro escolhido.')
  async list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: WaConversationQueryDto,
  ): Promise<CursorPage<WaConversationDocument>> {
    const ctx = ctxOf(membership);

    return this.conversations.list(ctx, await this.access.require(ctx, 'atendente'), query);
  }

  @Get(':conversationId')
  @ApiOkResponse({ description: 'Conversa.', type: WaConversation })
  async get(
    @CurrentMembership() membership: RequestMembership,
    @Param('conversationId', ParseObjectIdPipe) conversationId: Types.ObjectId,
  ): Promise<WaConversationDocument> {
    const ctx = ctxOf(membership);

    return this.conversations.require(
      ctx,
      await this.access.require(ctx, 'atendente'),
      conversationId,
    );
  }

  @Post(':conversationId/read')
  @ApiOkResponse({ description: 'Conversa marcada como lida.', type: WaConversation })
  async read(
    @CurrentMembership() membership: RequestMembership,
    @Param('conversationId', ParseObjectIdPipe) conversationId: Types.ObjectId,
  ): Promise<WaConversationDocument> {
    const ctx = ctxOf(membership);
    const conversation = await this.conversations.markRead(
      ctx,
      await this.access.require(ctx, 'atendente'),
      conversationId,
    );

    await this.messages.markReadOnMeta(conversation);

    return conversation;
  }

  @Post(':conversationId/assign')
  @ApiOkResponse({ description: 'Responsável definido.', type: WaConversation })
  async assign(
    @CurrentMembership() membership: RequestMembership,
    @Param('conversationId', ParseObjectIdPipe) conversationId: Types.ObjectId,
    @Body() dto: AssignWaConversationDto,
  ): Promise<WaConversationDocument> {
    const ctx = ctxOf(membership);

    return this.conversations.assign(
      ctx,
      await this.access.require(ctx, 'atendente'),
      conversationId,
      dto,
    );
  }

  @Post(':conversationId/priority')
  @ApiOkResponse({ description: 'Prioridade alterada.', type: WaConversation })
  async priority(
    @CurrentMembership() membership: RequestMembership,
    @Param('conversationId', ParseObjectIdPipe) conversationId: Types.ObjectId,
    @Body() dto: WaPriorityDto,
  ): Promise<WaConversationDocument> {
    const ctx = ctxOf(membership);

    return this.conversations.setPriority(
      ctx,
      await this.access.require(ctx, 'atendente'),
      conversationId,
      dto,
    );
  }

  @Post(':conversationId/mode')
  @ApiOkResponse({ description: 'Modo bot/humano alterado.', type: WaConversation })
  async mode(
    @CurrentMembership() membership: RequestMembership,
    @Param('conversationId', ParseObjectIdPipe) conversationId: Types.ObjectId,
    @Body() dto: WaModeDto,
  ): Promise<WaConversationDocument> {
    const ctx = ctxOf(membership);

    return this.conversations.setMode(
      ctx,
      await this.access.require(ctx, 'supervisor'),
      conversationId,
      dto,
    );
  }

  @Post(':conversationId/close')
  @ApiOkResponse({ description: 'Conversa finalizada.', type: WaConversation })
  async close(
    @CurrentMembership() membership: RequestMembership,
    @Param('conversationId', ParseObjectIdPipe) conversationId: Types.ObjectId,
  ): Promise<WaConversationDocument> {
    const ctx = ctxOf(membership);
    const conversation = await this.conversations.close(
      ctx,
      await this.access.require(ctx, 'atendente'),
      conversationId,
    );

    await this.bot.onClosed(conversation);

    return conversation;
  }

  @Post(':conversationId/reopen')
  @ApiOkResponse({ description: 'Conversa reaberta.', type: WaConversation })
  async reopen(
    @CurrentMembership() membership: RequestMembership,
    @Param('conversationId', ParseObjectIdPipe) conversationId: Types.ObjectId,
  ): Promise<WaConversationDocument> {
    const ctx = ctxOf(membership);

    return this.conversations.reopen(
      ctx,
      await this.access.require(ctx, 'atendente'),
      conversationId,
    );
  }

  @Get(':conversationId/messages')
  @ApiPagedResponse(WaMessage, 'Mensagens da conversa, da mais nova para a mais antiga.')
  async listMessages(
    @CurrentMembership() membership: RequestMembership,
    @Param('conversationId', ParseObjectIdPipe) conversationId: Types.ObjectId,
    @Query() query: PaginationQueryDto,
  ): Promise<CursorPage<WaMessageDocument>> {
    const ctx = ctxOf(membership);

    return this.messages.list(
      ctx,
      await this.access.require(ctx, 'atendente'),
      conversationId,
      query,
    );
  }

  @Post(':conversationId/messages')
  @ApiCreatedResponse({ description: 'Texto enviado.', type: WaMessage })
  async sendText(
    @CurrentMembership() membership: RequestMembership,
    @Param('conversationId', ParseObjectIdPipe) conversationId: Types.ObjectId,
    @Body() dto: SendWaTextDto,
  ): Promise<WaMessageDocument> {
    const ctx = ctxOf(membership);

    return this.messages.sendText(
      ctx,
      await this.access.require(ctx, 'atendente'),
      conversationId,
      dto,
    );
  }

  @Post(':conversationId/messages/media')
  @UploadMedia()
  @ApiConsumes('multipart/form-data')
  @UploadBody()
  @ApiCreatedResponse({ description: 'Mídia enviada.', type: WaMessage })
  async sendMedia(
    @CurrentMembership() membership: RequestMembership,
    @Param('conversationId', ParseObjectIdPipe) conversationId: Types.ObjectId,
    @UploadedFileParam() file: UploadedFile | undefined,
    @Body() dto: SendWaMediaDto,
  ): Promise<WaMessageDocument> {
    const ctx = ctxOf(membership);

    return this.messages.sendMedia(
      ctx,
      await this.access.require(ctx, 'atendente'),
      conversationId,
      file,
      dto,
    );
  }

  @Post(':conversationId/messages/template')
  @ApiCreatedResponse({ description: 'Template enviado.', type: WaMessage })
  async sendTemplate(
    @CurrentMembership() membership: RequestMembership,
    @Param('conversationId', ParseObjectIdPipe) conversationId: Types.ObjectId,
    @Body() dto: SendWaTemplateDto,
  ): Promise<WaMessageDocument> {
    const ctx = ctxOf(membership);

    return this.messages.sendTemplate(
      ctx,
      await this.access.require(ctx, 'atendente'),
      conversationId,
      dto,
    );
  }

  @Post(':conversationId/task')
  @ApiCreatedResponse({ description: 'Tarefa criada a partir da conversa.', type: Task })
  async createTask(
    @CurrentMembership() membership: RequestMembership,
    @Param('conversationId', ParseObjectIdPipe) conversationId: Types.ObjectId,
    @Body() dto: WaConversationTaskDto,
  ): Promise<TaskDocument> {
    const ctx = ctxOf(membership);

    return this.tasks.createTask(
      ctx,
      await this.access.require(ctx, 'atendente'),
      conversationId,
      dto,
    );
  }

  @Post(':conversationId/lead')
  @ApiCreatedResponse({ description: 'Lead criado em Comercial › Leads.', type: Task })
  async createLead(
    @CurrentMembership() membership: RequestMembership,
    @Param('conversationId', ParseObjectIdPipe) conversationId: Types.ObjectId,
    @Body() dto: WaConversationLeadDto,
  ): Promise<TaskDocument> {
    const ctx = ctxOf(membership);

    return this.tasks.createLead(
      ctx,
      await this.access.require(ctx, 'atendente'),
      conversationId,
      dto,
    );
  }
}

@ApiTags('whatsapp')
@ApiBearerAuth()
@ApiWorkspaceParam()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/whatsapp/contacts')
export class WhatsappContactsController {
  constructor(
    private readonly access: WhatsappAccessService,
    private readonly contacts: WhatsappContactsService,
  ) {}

  @Get()
  @ApiPagedResponse(WaContact, 'Contatos do WhatsApp.')
  async list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: WaContactQueryDto,
  ): Promise<CursorPage<WaContactDocument>> {
    const ctx = ctxOf(membership);

    await this.access.require(ctx, 'supervisor');

    return this.contacts.list(ctx, query);
  }

  @Get(':contactId')
  @ApiOkResponse({ description: 'Contato.', type: WaContact })
  async get(
    @CurrentMembership() membership: RequestMembership,
    @Param('contactId', ParseObjectIdPipe) contactId: Types.ObjectId,
  ): Promise<WaContactDocument> {
    const ctx = ctxOf(membership);

    await this.access.require(ctx, 'supervisor');

    return this.contacts.require(ctx, contactId);
  }

  @Post()
  @ApiCreatedResponse({ description: 'Contato criado.', type: WaContact })
  async create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateWaContactDto,
  ): Promise<WaContactDocument> {
    const ctx = ctxOf(membership);

    await this.access.require(ctx, 'supervisor');

    return this.contacts.create(ctx, dto);
  }

  @Patch(':contactId')
  @ApiOkResponse({ description: 'Contato atualizado.', type: WaContact })
  async update(
    @CurrentMembership() membership: RequestMembership,
    @Param('contactId', ParseObjectIdPipe) contactId: Types.ObjectId,
    @Body() dto: UpdateWaContactDto,
  ): Promise<WaContactDocument> {
    const ctx = ctxOf(membership);

    await this.access.require(ctx, 'supervisor');

    return this.contacts.update(ctx, contactId, dto);
  }

  @Delete(':contactId')
  @ApiOkResponse({ description: 'Contato removido.', type: SuccessDto })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('contactId', ParseObjectIdPipe) contactId: Types.ObjectId,
  ): Promise<{ success: true }> {
    const ctx = ctxOf(membership);

    await this.access.require(ctx, 'supervisor');
    await this.contacts.remove(ctx, contactId);

    return { success: true };
  }
}
