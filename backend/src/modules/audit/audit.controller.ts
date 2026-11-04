import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiPagedResponse } from '../../common/swagger/api-paged-response.decorator';
import { CursorPage } from '../../common/pagination/cursor';
import { Roles } from '../workspaces/decorators/roles.decorator';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership, workspaceObjectId } from '../workspaces/workspace-context';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Roles('admin')
  @ApiPagedResponse(AuditLog, 'Ações de administração do workspace, mais recentes primeiro.')
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: AuditQueryDto,
  ): Promise<CursorPage<AuditLogDocument>> {
    return this.audit.list(workspaceObjectId(membership), query);
  }
}
