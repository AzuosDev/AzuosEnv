import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ApiPagedResponse } from '../../common/swagger/api-paged-response.decorator';
import { ApiWorkspaceParam } from '../../common/swagger/api-workspace-param.decorator';
import { Response } from 'express';
import { Types } from 'mongoose';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CursorPage } from '../../common/pagination/cursor';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { permissionContextFrom } from '../hierarchy/permission.service';
import { Roles } from '../workspaces/decorators/roles.decorator';
import {
  CurrentMembership,
  CurrentWorkspace,
} from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { WorkspaceDocument } from '../workspaces/schemas/workspace.schema';
import { RequestMembership } from '../workspaces/workspace-context';
import {
  AiAssistService,
  AiConfirmResult,
  AiSummaryResult,
  AiTaskProposalResult,
  AiWriteResult,
} from './ai-assist.service';
import { AiAgentsService } from './ai-agents.service';
import { AiChatService } from './ai-chat.service';
import { AiUsageService, AiUsageSummary } from './ai-usage.service';
import {
  AiConfirmResultDto,
  AiSummaryResultDto,
  AiTaskProposalResultDto,
  AiUsageSummaryDto,
  AiWriteResultDto,
} from './dto/ai-result.dto';
import {
  AiChatDto,
  AiSummarizeDto,
  AiTasksFromTextDto,
  AiWriteDto,
  ConfirmTasksFromTextDto,
  CreateAiAgentDto,
  UpdateAiAgentDto,
} from './dto/ai.dto';
import { AiEnabledGuard } from './guards/ai-enabled.guard';
import { AiAgent, AiAgentDocument } from './schemas/ai-agent.schema';

@ApiTags('ai')
@ApiBearerAuth()
@ApiWorkspaceParam()
@UseGuards(WorkspaceGuard, AiEnabledGuard)
@Controller('workspaces/:wsId/ai')
export class AiController {
  constructor(
    private readonly chat: AiChatService,
    private readonly assist: AiAssistService,
    private readonly usage: AiUsageService,
  ) {}

  /**
   * Stream SSE: cada bloco é um JSON com type start | delta | tool | done | error.
   */
  @Post('chat')
  @ApiOkResponse({ description: 'Resposta da IA em stream SSE.' })
  async chatStream(
    @CurrentMembership() membership: RequestMembership,
    @CurrentWorkspace() workspace: WorkspaceDocument,
    @CurrentUser('timezone') timezone: string,
    @Body() dto: AiChatDto,
    @Res() response: Response,
  ): Promise<void> {
    // Runs before the first byte so a blocked request still answers JSON.
    const session = await this.chat.start({
      ctx: permissionContextFrom(membership),
      workspaceName: workspace.name,
      timeZone: timezone,
      dto,
    });

    response.status(HttpStatus.OK);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();

    try {
      for await (const event of this.chat.stream(session)) {
        response.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (error) {
      response.write(`data: ${JSON.stringify({ type: 'error', ...this.errorOf(error) })}\n\n`);
    } finally {
      response.end();
    }
  }

  @Post('summarize')
  @ApiOkResponse({
    description: 'Resumo da tarefa, thread, canal ou Doc.',
    type: AiSummaryResultDto,
  })
  summarize(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: AiSummarizeDto,
  ): Promise<AiSummaryResult> {
    return this.assist.summarize(permissionContextFrom(membership), dto);
  }

  @Post('tasks-from-text')
  @ApiOkResponse({
    description: 'Proposta de tarefas validada; nada é criado aqui.',
    type: AiTaskProposalResultDto,
  })
  tasksFromText(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: AiTasksFromTextDto,
  ): Promise<AiTaskProposalResult> {
    return this.assist.tasksFromText(permissionContextFrom(membership), dto);
  }

  @Post('tasks-from-text/confirm')
  @ApiCreatedResponse({
    description: 'Tarefas criadas a partir da proposta confirmada.',
    type: AiConfirmResultDto,
  })
  confirmTasksFromText(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: ConfirmTasksFromTextDto,
  ): Promise<AiConfirmResult> {
    return this.assist.confirmTasks(permissionContextFrom(membership), dto);
  }

  @Post('write')
  @ApiOkResponse({ description: 'Texto reescrito pela IA.', type: AiWriteResultDto })
  write(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: AiWriteDto,
  ): Promise<AiWriteResult> {
    return this.assist.write(permissionContextFrom(membership), dto);
  }

  @Get('usage')
  @ApiOkResponse({
    description: 'Consumo de tokens do mês e orçamento do workspace.',
    type: AiUsageSummaryDto,
  })
  usageSummary(@CurrentMembership() membership: RequestMembership): Promise<AiUsageSummary> {
    return this.usage.summary(permissionContextFrom(membership).workspaceId);
  }

  private errorOf(error: unknown): { code: string; message: string } {
    if (error instanceof HttpException) {
      const payload = error.getResponse();

      if (typeof payload === 'object' && payload !== null) {
        const record = payload as Record<string, unknown>;

        return {
          code: typeof record.code === 'string' ? record.code : 'AI_ERROR',
          message: typeof record.message === 'string' ? record.message : error.message,
        };
      }
    }

    return { code: 'AI_ERROR', message: 'Falha ao responder.' };
  }
}

@ApiTags('ai')
@ApiBearerAuth()
@ApiWorkspaceParam()
@UseGuards(WorkspaceGuard, AiEnabledGuard)
@Controller('workspaces/:wsId/ai/agents')
export class AiAgentsController {
  constructor(private readonly agents: AiAgentsService) {}

  @Post()
  @Roles('admin')
  @ApiCreatedResponse({ description: 'Agente agendado criado.', type: AiAgent })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateAiAgentDto,
  ): Promise<AiAgentDocument> {
    return this.agents.create(permissionContextFrom(membership), dto);
  }

  @Get()
  @ApiPagedResponse(AiAgent, 'Agentes do workspace, mais novos primeiro.')
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: PaginationQueryDto,
  ): Promise<CursorPage<AiAgentDocument>> {
    return this.agents.list(permissionContextFrom(membership), query);
  }

  @Get(':agentId')
  @ApiOkResponse({ description: 'Agente agendado.', type: AiAgent })
  get(
    @CurrentMembership() membership: RequestMembership,
    @Param('agentId', ParseObjectIdPipe) agentId: Types.ObjectId,
  ): Promise<AiAgentDocument> {
    return this.agents.get(permissionContextFrom(membership), agentId);
  }

  @Patch(':agentId')
  @Roles('admin')
  @ApiOkResponse({ description: 'Agente atualizado.', type: AiAgent })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('agentId', ParseObjectIdPipe) agentId: Types.ObjectId,
    @Body() dto: UpdateAiAgentDto,
  ): Promise<AiAgentDocument> {
    return this.agents.update(permissionContextFrom(membership), agentId, dto);
  }

  @Delete(':agentId')
  @Roles('admin')
  @ApiOkResponse({ description: 'Agente removido.' })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('agentId', ParseObjectIdPipe) agentId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.agents.remove(permissionContextFrom(membership), agentId);

    return { success: true };
  }
}
