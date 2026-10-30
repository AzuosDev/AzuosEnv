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
import { Response } from 'express';
import { Types } from 'mongoose';
import { CursorPage } from '../../common/pagination/cursor';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { ReorderDto } from '../hierarchy/dto/reorder.dto';
import { permissionContextFrom } from '../hierarchy/permission.service';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import { CreateViewDto, ExportQueryDto, UpdateViewDto, ViewQueryDto } from './dto/view.dto';
import { ViewDocument } from './schemas/view.schema';
import { ViewExportService } from './view-export.service';
import { ViewsService } from './views.service';

@ApiTags('views')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/views')
export class ViewsController {
  constructor(
    private readonly views: ViewsService,
    private readonly exports: ViewExportService,
  ) {}

  @Post()
  @ApiCreatedResponse({ description: 'View criada.' })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateViewDto,
  ): Promise<ViewDocument> {
    return this.views.create(permissionContextFrom(membership), dto);
  }

  @Get()
  @ApiOkResponse({ description: 'Views visíveis; com locationType vêm na ordem manual.' })
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: ViewQueryDto,
  ): Promise<CursorPage<ViewDocument>> {
    return this.views.list(permissionContextFrom(membership), query);
  }

  @Get(':viewId')
  @ApiOkResponse({ description: 'View.' })
  get(
    @CurrentMembership() membership: RequestMembership,
    @Param('viewId', ParseObjectIdPipe) viewId: Types.ObjectId,
  ): Promise<ViewDocument> {
    return this.views.get(permissionContextFrom(membership), viewId);
  }

  @Get(':viewId/export')
  @ApiOkResponse({ description: 'Tarefas da view em csv ou xlsx.' })
  async export(
    @CurrentMembership() membership: RequestMembership,
    @Param('viewId', ParseObjectIdPipe) viewId: Types.ObjectId,
    @Query() query: ExportQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.exports.export(
      permissionContextFrom(membership),
      viewId,
      query.format ?? 'csv',
    );

    response
      .status(HttpStatus.OK)
      .setHeader('Content-Type', result.contentType)
      .setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
      .setHeader('Content-Length', result.body.length)
      .send(result.body);
  }

  @Patch(':viewId')
  @ApiOkResponse({ description: 'View atualizada.' })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('viewId', ParseObjectIdPipe) viewId: Types.ObjectId,
    @Body() dto: UpdateViewDto,
  ): Promise<ViewDocument> {
    return this.views.update(permissionContextFrom(membership), viewId, dto);
  }

  @Post(':viewId/duplicate')
  @ApiCreatedResponse({ description: 'View duplicada no mesmo local.' })
  duplicate(
    @CurrentMembership() membership: RequestMembership,
    @Param('viewId', ParseObjectIdPipe) viewId: Types.ObjectId,
  ): Promise<ViewDocument> {
    return this.views.duplicate(permissionContextFrom(membership), viewId);
  }

  @Post(':viewId/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'View reordenada no local.' })
  reorder(
    @CurrentMembership() membership: RequestMembership,
    @Param('viewId', ParseObjectIdPipe) viewId: Types.ObjectId,
    @Body() dto: ReorderDto,
  ): Promise<ViewDocument> {
    return this.views.reorder(permissionContextFrom(membership), viewId, dto);
  }

  @Delete(':viewId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'View excluída.' })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('viewId', ParseObjectIdPipe) viewId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.views.remove(permissionContextFrom(membership), viewId);

    return { success: true };
  }
}
