import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ApiPagedResponse } from '../../common/swagger/api-paged-response.decorator';
import { Types } from 'mongoose';
import { CursorPage } from '../../common/pagination/cursor';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { Audit } from '../audit/audit.decorator';
import { CurrentMembership } from './decorators/workspace-context.decorator';
import { Roles } from './decorators/roles.decorator';
import { UpdateMemberRoleDto } from './dto/member.dto';
import { WorkspaceGuard } from './guards/workspace.guard';
import { MembersService } from './members.service';
import { WorkspaceMember, WorkspaceMemberDocument } from './schemas/workspace-member.schema';
import { RequestMembership, workspaceObjectId } from './workspace-context';

@ApiTags('workspace-members')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @ApiPagedResponse(WorkspaceMember, 'Membros do workspace.')
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: PaginationQueryDto,
  ): Promise<CursorPage<WorkspaceMemberDocument>> {
    return this.members.list(workspaceObjectId(membership), query);
  }

  @Patch(':memberId')
  @Audit('member.role.changed', 'member', 'memberId')
  @Roles('admin')
  @ApiOkResponse({ description: 'Papel do membro atualizado.', type: WorkspaceMember })
  updateRole(
    @CurrentMembership() membership: RequestMembership,
    @Param('memberId', ParseObjectIdPipe) memberId: Types.ObjectId,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<WorkspaceMemberDocument> {
    return this.members.updateRole(workspaceObjectId(membership), memberId, membership, dto.role);
  }

  @Post(':memberId/deactivate')
  @Audit('member.deactivated', 'member', 'memberId')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Membro desativado.', type: WorkspaceMember })
  deactivate(
    @CurrentMembership() membership: RequestMembership,
    @Param('memberId', ParseObjectIdPipe) memberId: Types.ObjectId,
  ): Promise<WorkspaceMemberDocument> {
    return this.members.deactivate(workspaceObjectId(membership), memberId, membership);
  }
}
