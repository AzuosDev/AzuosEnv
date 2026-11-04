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
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ApiPagedResponse } from '../../common/swagger/api-paged-response.decorator';
import { Response } from 'express';
import { Types } from 'mongoose';
import { CursorPage } from '../../common/pagination/cursor';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { CSV_CONTENT_TYPE, toCsvBuffer } from '../../common/utils/csv';
import { slugify } from '../../common/utils/slug';
import { permissionContextFrom } from '../hierarchy/permission.service';
import { Roles } from '../workspaces/decorators/roles.decorator';
import {
  CurrentMembership,
  CurrentWorkspace,
} from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { WorkspaceDocument } from '../workspaces/schemas/workspace.schema';
import { RequestMembership } from '../workspaces/workspace-context';
import { timezoneOf } from '../time/timesheets.controller';
import { CardData, CardDataService } from './card-data.service';
import { cardTable } from './card-csv';
import { CardType } from './dashboard-cards';
import { DashboardsService, plainConfig } from './dashboards.service';
import {
  CardConfigDto,
  CardDataDto,
  CreateDashboardDto,
  DashboardQueryDto,
  UpdateDashboardDto,
} from './dto/dashboard.dto';
import { Dashboard, DashboardDocument } from './schemas/dashboard.schema';

interface CardDataResponse {
  cardId: string;
  type: CardType;
  data: CardData;
}

@ApiTags('dashboards')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/dashboards')
export class DashboardsController {
  constructor(
    private readonly dashboards: DashboardsService,
    private readonly cards: CardDataService,
  ) {}

  @Post()
  @Roles('member')
  @ApiCreatedResponse({ description: 'Dashboard criado.', type: Dashboard })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateDashboardDto,
  ): Promise<DashboardDocument> {
    return this.dashboards.create(permissionContextFrom(membership), dto);
  }

  @Get()
  @ApiPagedResponse(Dashboard, 'Dashboards visíveis, mais novos primeiro.')
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: DashboardQueryDto,
  ): Promise<CursorPage<DashboardDocument>> {
    return this.dashboards.list(permissionContextFrom(membership), query);
  }

  @Get(':dashboardId')
  @ApiOkResponse({ description: 'Dashboard.', type: Dashboard })
  get(
    @CurrentMembership() membership: RequestMembership,
    @Param('dashboardId', ParseObjectIdPipe) dashboardId: Types.ObjectId,
  ): Promise<DashboardDocument> {
    return this.dashboards.requireVisible(permissionContextFrom(membership), dashboardId);
  }

  @Patch(':dashboardId')
  @ApiOkResponse({ description: 'Dashboard atualizado.', type: Dashboard })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('dashboardId', ParseObjectIdPipe) dashboardId: Types.ObjectId,
    @Body() dto: UpdateDashboardDto,
  ): Promise<DashboardDocument> {
    return this.dashboards.update(permissionContextFrom(membership), dashboardId, dto);
  }

  @Delete(':dashboardId')
  @ApiOkResponse({ description: 'Dashboard excluído.' })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('dashboardId', ParseObjectIdPipe) dashboardId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.dashboards.remove(permissionContextFrom(membership), dashboardId);

    return { success: true };
  }

  @Post(':dashboardId/cards/:cardId/data')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Dados agregados do card.' })
  async data(
    @CurrentMembership() membership: RequestMembership,
    @CurrentWorkspace() workspace: WorkspaceDocument,
    @Param('dashboardId', ParseObjectIdPipe) dashboardId: Types.ObjectId,
    @Param('cardId') cardId: string,
    @Body() dto: CardDataDto,
  ): Promise<CardDataResponse> {
    const ctx = permissionContextFrom(membership);
    const dashboard = await this.dashboards.requireVisible(ctx, dashboardId);
    const card = this.dashboards.requireCard(dashboard, cardId);
    const config = { ...card.config, ...plainConfig(dto.config) } as CardConfigDto;

    return {
      cardId,
      type: card.type,
      data: await this.cards.data(ctx, timezoneOf(workspace), card.type, config),
    };
  }

  @Get(':dashboardId/cards/:cardId/export')
  @ApiOkResponse({ description: 'Dados do card em CSV.' })
  async export(
    @CurrentMembership() membership: RequestMembership,
    @CurrentWorkspace() workspace: WorkspaceDocument,
    @Param('dashboardId', ParseObjectIdPipe) dashboardId: Types.ObjectId,
    @Param('cardId') cardId: string,
    @Res() response: Response,
  ): Promise<void> {
    const ctx = permissionContextFrom(membership);
    const dashboard = await this.dashboards.requireVisible(ctx, dashboardId);
    const card = this.dashboards.requireCard(dashboard, cardId);
    const data = await this.cards.data(
      ctx,
      timezoneOf(workspace),
      card.type,
      card.config as CardConfigDto,
    );
    const table = cardTable(card.type, data);
    const body = toCsvBuffer(table.columns, table.rows);

    response
      .status(HttpStatus.OK)
      .setHeader('Content-Type', CSV_CONTENT_TYPE)
      .setHeader('Content-Disposition', `attachment; filename="${slugify(card.type)}.csv"`)
      .setHeader('Content-Length', body.length)
      .send(body);
  }
}
