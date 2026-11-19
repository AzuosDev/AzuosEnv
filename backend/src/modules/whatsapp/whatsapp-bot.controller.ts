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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { SuccessDto } from '../../common/dto/api-error.dto';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { ApiWorkspaceParam } from '../../common/swagger/api-workspace-param.decorator';
import { Audit } from '../audit/audit.decorator';
import { PermissionContext, permissionContextFrom } from '../hierarchy/permission.service';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import {
  WaBotRuleListDto,
  WaOverviewDto,
  WaQuickReplyPageDto,
} from './dto/whatsapp-bot-result.dto';
import {
  CreateWaBotRuleDto,
  CreateWaQuickReplyDto,
  SaveWaBotSettingsDto,
  UpdateWaBotRuleDto,
  UpdateWaQuickReplyDto,
  WaOverviewQueryDto,
  WaQuickReplyQueryDto,
} from './dto/whatsapp-bot.dto';
import { WaBotRule, WaBotRuleDocument } from './schemas/wa-bot-rule.schema';
import { WaBotSettings, WaBotSettingsDocument } from './schemas/wa-bot-settings.schema';
import { WaQuickReply, WaQuickReplyDocument } from './schemas/wa-quick-reply.schema';
import { WhatsappAccessService } from './whatsapp-access.service';
import { WhatsappBotSettingsService } from './whatsapp-bot-settings.service';
import { WhatsappContactsService } from './whatsapp-contacts.service';
import { WhatsappConversationsService } from './whatsapp-conversations.service';
import { WhatsappMetricsService } from './whatsapp-metrics.service';
import { WhatsappQuickRepliesService } from './whatsapp-quick-replies.service';
import { WaTextVariables } from './whatsapp-bot-text';

function ctxOf(membership: RequestMembership): PermissionContext {
  return permissionContextFrom(membership);
}

/** Bot, menu, hours and rules of the attendance. Only a gestor gets here. */
@ApiTags('whatsapp')
@ApiBearerAuth()
@ApiWorkspaceParam()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/whatsapp/bot')
export class WhatsappBotController {
  constructor(
    private readonly access: WhatsappAccessService,
    private readonly settings: WhatsappBotSettingsService,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'Configurações do bot e do atendimento.', type: WaBotSettings })
  async get(@CurrentMembership() membership: RequestMembership): Promise<WaBotSettingsDocument> {
    const ctx = ctxOf(membership);

    await this.access.require(ctx, 'gestor');

    return this.settings.get(ctx.workspaceId);
  }

  @Put()
  @Audit('whatsapp.bot.saved', 'integration')
  @ApiOkResponse({ description: 'Configurações salvas.', type: WaBotSettings })
  async save(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: SaveWaBotSettingsDto,
  ): Promise<WaBotSettingsDocument> {
    const ctx = ctxOf(membership);

    await this.access.require(ctx, 'gestor');

    return this.settings.save(ctx, dto);
  }

  @Get('rules')
  @ApiOkResponse({
    description: 'Regras do bot, da maior prioridade para a menor.',
    type: WaBotRuleListDto,
  })
  async listRules(
    @CurrentMembership() membership: RequestMembership,
  ): Promise<{ items: WaBotRuleDocument[] }> {
    const ctx = ctxOf(membership);

    await this.access.require(ctx, 'gestor');

    return { items: await this.settings.listRules(ctx.workspaceId) };
  }

  @Post('rules')
  @Audit('whatsapp.bot.rule.saved', 'integration')
  @ApiCreatedResponse({ description: 'Regra criada.', type: WaBotRule })
  async createRule(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateWaBotRuleDto,
  ): Promise<WaBotRuleDocument> {
    const ctx = ctxOf(membership);

    await this.access.require(ctx, 'gestor');

    return this.settings.createRule(ctx, dto);
  }

  @Patch('rules/:ruleId')
  @Audit('whatsapp.bot.rule.saved', 'integration', 'ruleId')
  @ApiOkResponse({ description: 'Regra atualizada.', type: WaBotRule })
  async updateRule(
    @CurrentMembership() membership: RequestMembership,
    @Param('ruleId', ParseObjectIdPipe) ruleId: Types.ObjectId,
    @Body() dto: UpdateWaBotRuleDto,
  ): Promise<WaBotRuleDocument> {
    const ctx = ctxOf(membership);

    await this.access.require(ctx, 'gestor');

    return this.settings.updateRule(ctx, ruleId, dto);
  }

  @Delete('rules/:ruleId')
  @Audit('whatsapp.bot.rule.deleted', 'integration', 'ruleId')
  @ApiOkResponse({ description: 'Regra removida.', type: SuccessDto })
  async removeRule(
    @CurrentMembership() membership: RequestMembership,
    @Param('ruleId', ParseObjectIdPipe) ruleId: Types.ObjectId,
  ): Promise<{ success: true }> {
    const ctx = ctxOf(membership);

    await this.access.require(ctx, 'gestor');
    await this.settings.removeRule(ctx, ruleId);

    return { success: true };
  }
}

/**
 * Quick replies of the message field. Every attendant reads them, since the `/`
 * of the composer searches by the shortcut; only a gestor writes them.
 */
@ApiTags('whatsapp')
@ApiBearerAuth()
@ApiWorkspaceParam()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/whatsapp/quick-replies')
export class WhatsappQuickRepliesController {
  constructor(
    private readonly access: WhatsappAccessService,
    private readonly quickReplies: WhatsappQuickRepliesService,
    private readonly conversations: WhatsappConversationsService,
    private readonly contacts: WhatsappContactsService,
  ) {}

  @Get()
  @ApiOkResponse({
    description: 'Respostas rápidas; com conversationId as variáveis vêm resolvidas.',
    type: WaQuickReplyPageDto,
  })
  async list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: WaQuickReplyQueryDto,
  ): Promise<WaQuickReplyPageDto> {
    const ctx = ctxOf(membership);
    const level = await this.access.require(ctx, 'atendente');

    return this.quickReplies.list(ctx, query, await this.variablesOf(ctx, level, query));
  }

  @Post()
  @ApiCreatedResponse({ description: 'Resposta rápida criada.', type: WaQuickReply })
  async create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateWaQuickReplyDto,
  ): Promise<WaQuickReplyDocument> {
    const ctx = ctxOf(membership);

    await this.access.require(ctx, 'gestor');

    return this.quickReplies.create(ctx, dto);
  }

  @Patch(':quickReplyId')
  @ApiOkResponse({ description: 'Resposta rápida atualizada.', type: WaQuickReply })
  async update(
    @CurrentMembership() membership: RequestMembership,
    @Param('quickReplyId', ParseObjectIdPipe) quickReplyId: Types.ObjectId,
    @Body() dto: UpdateWaQuickReplyDto,
  ): Promise<WaQuickReplyDocument> {
    const ctx = ctxOf(membership);

    await this.access.require(ctx, 'gestor');

    return this.quickReplies.update(ctx, quickReplyId, dto);
  }

  @Delete(':quickReplyId')
  @ApiOkResponse({ description: 'Resposta rápida removida.', type: SuccessDto })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('quickReplyId', ParseObjectIdPipe) quickReplyId: Types.ObjectId,
  ): Promise<{ success: true }> {
    const ctx = ctxOf(membership);

    await this.access.require(ctx, 'gestor');
    await this.quickReplies.remove(ctx, quickReplyId);

    return { success: true };
  }

  /** Variables of the conversation, so the `/` of the composer shows real text. */
  private async variablesOf(
    ctx: PermissionContext,
    level: Awaited<ReturnType<WhatsappAccessService['require']>>,
    query: WaQuickReplyQueryDto,
  ): Promise<WaTextVariables> {
    if (!query.conversationId) {
      return {};
    }

    const conversation = await this.conversations.require(
      ctx,
      level,
      new Types.ObjectId(query.conversationId),
    );
    const contact = await this.contacts.require(ctx, conversation.contactId);

    return {
      nome: contact.name || contact.profileName || contact.waId,
      numero: contact.waId,
    };
  }
}

/** Numbers of the attendance in a period. */
@ApiTags('whatsapp')
@ApiBearerAuth()
@ApiWorkspaceParam()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/whatsapp/overview')
export class WhatsappOverviewController {
  constructor(
    private readonly access: WhatsappAccessService,
    private readonly metrics: WhatsappMetricsService,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'Visão geral do atendimento no período.', type: WaOverviewDto })
  async overview(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: WaOverviewQueryDto,
  ): Promise<WaOverviewDto> {
    const ctx = ctxOf(membership);

    await this.access.require(ctx, 'supervisor');

    return this.metrics.overview(ctx, query);
  }
}
