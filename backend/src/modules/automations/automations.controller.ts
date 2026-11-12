import {
  Body,
  Controller,
  Delete,
  Get,
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
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { permissionContextFrom } from '../hierarchy/permission.service';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import { AUTOMATION_RECIPES, AutomationRecipe } from './automation-recipes';
import { AutomationRunsService } from './automation-runs.service';
import { AutomationResult, AutomationsService } from './automations.service';
import {
  AutomationQueryDto,
  AutomationRunQueryDto,
  CreateAutomationDto,
  UpdateAutomationDto,
} from './dto/automation.dto';
import { AutomationRecipesDto, AutomationResultDto } from './dto/automation-result.dto';
import { Automation, AutomationDocument } from './schemas/automation.schema';
import { AutomationRun, AutomationRunDocument } from './schemas/automation-run.schema';

@ApiTags('automations')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@ApiWorkspaceParam()
@Controller('workspaces/:wsId/automations')
export class AutomationsController {
  constructor(
    private readonly automations: AutomationsService,
    private readonly runs: AutomationRunsService,
  ) {}

  @Post()
  @ApiCreatedResponse({
    description: 'Automação criada; o secret do hook aparece uma única vez.',
    type: AutomationResultDto,
  })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateAutomationDto,
  ): Promise<AutomationResult> {
    return this.automations.create(permissionContextFrom(membership), dto);
  }

  @Get()
  @ApiPagedResponse(Automation, 'Automações dos locais visíveis, mais novas primeiro.')
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: AutomationQueryDto,
  ): Promise<CursorPage<AutomationDocument>> {
    return this.automations.list(permissionContextFrom(membership), query);
  }

  /** Declared before :automationId so the word is not read as an id. */
  @Get('recipes')
  @ApiOkResponse({ description: 'Receitas prontas de automação.', type: AutomationRecipesDto })
  recipes(): { items: AutomationRecipe[] } {
    return { items: AUTOMATION_RECIPES };
  }

  @Get(':automationId')
  @ApiOkResponse({ description: 'Automação.', type: Automation })
  get(
    @CurrentMembership() membership: RequestMembership,
    @Param('automationId', ParseObjectIdPipe) automationId: Types.ObjectId,
  ): Promise<AutomationDocument> {
    return this.automations.requireAutomation(
      permissionContextFrom(membership),
      automationId,
      'view',
    );
  }

  @Patch(':automationId')
  @ApiOkResponse({ description: 'Automação atualizada.', type: AutomationResultDto })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('automationId', ParseObjectIdPipe) automationId: Types.ObjectId,
    @Body() dto: UpdateAutomationDto,
  ): Promise<AutomationResult> {
    return this.automations.update(permissionContextFrom(membership), automationId, dto);
  }

  @Delete(':automationId')
  @ApiOkResponse({ description: 'Automação excluída.', type: SuccessDto })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('automationId', ParseObjectIdPipe) automationId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.automations.remove(permissionContextFrom(membership), automationId);

    return { success: true };
  }

  @Get(':automationId/runs')
  @ApiPagedResponse(AutomationRun, 'Execuções da automação, mais novas primeiro.')
  async runHistory(
    @CurrentMembership() membership: RequestMembership,
    @Param('automationId', ParseObjectIdPipe) automationId: Types.ObjectId,
    @Query() query: AutomationRunQueryDto,
  ): Promise<CursorPage<AutomationRunDocument>> {
    const ctx = permissionContextFrom(membership);
    const automation = await this.automations.requireAutomation(ctx, automationId, 'view');

    return this.runs.list(ctx.workspaceId, automation._id, query);
  }
}
