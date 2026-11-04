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
import { CurrentMembership } from './decorators/workspace-context.decorator';
import { Roles } from './decorators/roles.decorator';
import { CreateTeamDto, UpdateTeamDto } from './dto/team.dto';
import { WorkspaceGuard } from './guards/workspace.guard';
import { Team, TeamDocument } from './schemas/team.schema';
import { TeamsService } from './teams.service';
import { RequestMembership, workspaceObjectId } from './workspace-context';

@ApiTags('workspace-teams')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Post()
  @Roles('admin')
  @ApiCreatedResponse({ description: 'Equipe criada.', type: Team })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateTeamDto,
  ): Promise<TeamDocument> {
    return this.teams.create(workspaceObjectId(membership), dto);
  }

  @Get()
  @ApiPagedResponse(Team, 'Equipes do workspace.')
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: PaginationQueryDto,
  ): Promise<CursorPage<TeamDocument>> {
    return this.teams.list(workspaceObjectId(membership), query);
  }

  @Patch(':teamId')
  @Roles('admin')
  @ApiOkResponse({ description: 'Equipe atualizada.', type: Team })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('teamId', ParseObjectIdPipe) teamId: Types.ObjectId,
    @Body() dto: UpdateTeamDto,
  ): Promise<TeamDocument> {
    return this.teams.update(workspaceObjectId(membership), teamId, dto);
  }

  @Delete(':teamId')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Equipe removida.' })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('teamId', ParseObjectIdPipe) teamId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.teams.remove(workspaceObjectId(membership), teamId);

    return { success: true };
  }
}
