import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ApiWorkspaceParam } from '../../common/swagger/api-workspace-param.decorator';
import { permissionContextFrom } from '../hierarchy/permission.service';
import {
  CurrentMembership,
  CurrentWorkspace,
} from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { WorkspaceDocument } from '../workspaces/schemas/workspace.schema';
import { RequestMembership } from '../workspaces/workspace-context';
import { WorkloadQueryDto, WorkloadResultDto } from './dto/workload.dto';
import { timezoneOf } from './timesheets.controller';
import { WorkloadResult, WorkloadService } from './workload.service';

@ApiTags('workload')
@ApiBearerAuth()
@ApiWorkspaceParam()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/workload')
export class WorkloadController {
  constructor(private readonly workload: WorkloadService) {}

  @Get()
  @ApiOkResponse({
    description: 'Valor por pessoa e dia, com a capacidade de cada membro.',
    type: WorkloadResultDto,
  })
  get(
    @CurrentMembership() membership: RequestMembership,
    @CurrentWorkspace() workspace: WorkspaceDocument,
    @Query() query: WorkloadQueryDto,
  ): Promise<WorkloadResult> {
    return this.workload.workload(permissionContextFrom(membership), timezoneOf(workspace), query);
  }
}
