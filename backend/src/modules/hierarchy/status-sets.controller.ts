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
import { ApiPagedResponse } from '../../common/swagger/api-paged-response.decorator';
import { Types } from 'mongoose';
import { CursorPage } from '../../common/pagination/cursor';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { Roles } from '../workspaces/decorators/roles.decorator';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership, workspaceObjectId } from '../workspaces/workspace-context';
import { CreateStatusSetDto, UpdateStatusSetDto } from './dto/status-set.dto';
import { StatusSet, StatusSetDocument } from './schemas/status-set.schema';
import { StatusSetsService } from './status-sets.service';

@ApiTags('status-sets')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/status-sets')
export class StatusSetsController {
  constructor(private readonly statusSets: StatusSetsService) {}

  @Post()
  @Roles('member')
  @ApiCreatedResponse({ description: 'Conjunto de statuses criado.', type: StatusSet })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateStatusSetDto,
  ): Promise<StatusSetDocument> {
    return this.statusSets.create(workspaceObjectId(membership), dto);
  }

  @Get()
  @ApiPagedResponse(StatusSet, 'Conjuntos de statuses do workspace.')
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: PaginationQueryDto,
  ): Promise<CursorPage<StatusSetDocument>> {
    return this.statusSets.list(workspaceObjectId(membership), query);
  }

  @Get(':statusSetId')
  @ApiOkResponse({ description: 'Conjunto de statuses.', type: StatusSet })
  get(
    @CurrentMembership() membership: RequestMembership,
    @Param('statusSetId', ParseObjectIdPipe) statusSetId: Types.ObjectId,
  ): Promise<StatusSetDocument> {
    return this.statusSets.get(workspaceObjectId(membership), statusSetId);
  }

  @Patch(':statusSetId')
  @Roles('member')
  @ApiOkResponse({ description: 'Conjunto de statuses atualizado.', type: StatusSet })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('statusSetId', ParseObjectIdPipe) statusSetId: Types.ObjectId,
    @Body() dto: UpdateStatusSetDto,
  ): Promise<StatusSetDocument> {
    return this.statusSets.update(workspaceObjectId(membership), statusSetId, dto);
  }

  @Delete(':statusSetId')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Conjunto de statuses removido.' })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('statusSetId', ParseObjectIdPipe) statusSetId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.statusSets.remove(workspaceObjectId(membership), statusSetId);

    return { success: true };
  }
}
