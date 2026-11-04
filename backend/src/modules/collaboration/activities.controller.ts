import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiPagedResponse } from '../../common/swagger/api-paged-response.decorator';
import { CursorPage } from '../../common/pagination/cursor';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { permissionContextFrom } from '../hierarchy/permission.service';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import { ActivitiesService } from './activities.service';
import { ActivityQueryDto } from './dto/activity.dto';
import { Activity, ActivityDocument } from './schemas/activity.schema';

@ApiTags('activity')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/tasks/:idOrCustomId/activity')
export class TaskActivityController {
  constructor(private readonly activities: ActivitiesService) {}

  @Get()
  @ApiPagedResponse(Activity, 'Histórico da tarefa, do mais recente ao mais antigo.')
  forTask(
    @CurrentMembership() membership: RequestMembership,
    @Param('idOrCustomId') idOrCustomId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<CursorPage<ActivityDocument>> {
    return this.activities.forTask(permissionContextFrom(membership), idOrCustomId, query);
  }
}

@ApiTags('activity')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/activity')
export class ActivityController {
  constructor(private readonly activities: ActivitiesService) {}

  @Get()
  @ApiPagedResponse(Activity, 'View Activity do workspace, filtrada por location.')
  forWorkspace(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: ActivityQueryDto,
  ): Promise<CursorPage<ActivityDocument>> {
    return this.activities.forWorkspace(permissionContextFrom(membership), query);
  }
}
