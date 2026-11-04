import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ApiPagedResponse } from '../../common/swagger/api-paged-response.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CursorPage } from '../../common/pagination/cursor';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { Audit } from '../audit/audit.decorator';
import { CurrentMembership, CurrentWorkspace } from './decorators/workspace-context.decorator';
import { Roles } from './decorators/roles.decorator';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { TransferOwnershipDto } from './dto/member.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceGuard } from './guards/workspace.guard';
import { WorkspaceMember, WorkspaceMemberDocument } from './schemas/workspace-member.schema';
import { Workspace, WorkspaceDocument } from './schemas/workspace.schema';
import { RequestMembership } from './workspace-context';
import { WorkspacesService } from './workspaces.service';

@ApiTags('workspaces')
@ApiBearerAuth()
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Workspace criado; quem cria vira owner.', type: Workspace })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateWorkspaceDto,
  ): Promise<WorkspaceDocument> {
    return this.workspaces.create(userId, dto);
  }

  @Get()
  @ApiPagedResponse(Workspace, 'Workspaces em que o usuário é membro ativo.')
  list(
    @CurrentUser('id') userId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<CursorPage<WorkspaceDocument>> {
    return this.workspaces.listForUser(userId, query);
  }

  @Get(':wsId')
  @UseGuards(WorkspaceGuard)
  @ApiOkResponse({ description: 'Workspace e papel do usuário.' })
  get(
    @CurrentWorkspace() workspace: WorkspaceDocument,
    @CurrentMembership() membership: RequestMembership,
  ): { workspace: WorkspaceDocument; role: string } {
    return { workspace, role: membership.role };
  }

  @Patch(':wsId')
  @Audit('workspace.updated', 'workspace')
  @UseGuards(WorkspaceGuard)
  @Roles('admin')
  @ApiOkResponse({ description: 'Workspace atualizado.', type: Workspace })
  update(
    @CurrentWorkspace() workspace: WorkspaceDocument,
    @Body() dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceDocument> {
    return this.workspaces.update(workspace, dto);
  }

  @Delete(':wsId')
  @Audit('workspace.deleted', 'workspace')
  @UseGuards(WorkspaceGuard)
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Workspace enviado para a lixeira.' })
  async remove(@CurrentWorkspace() workspace: WorkspaceDocument): Promise<{ success: true }> {
    await this.workspaces.softDelete(workspace);

    return { success: true };
  }

  @Post(':wsId/transfer-ownership')
  @Audit('workspace.ownership.transferred', 'workspace')
  @UseGuards(WorkspaceGuard)
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'Posse transferida; o antigo owner fica como admin.',
    type: WorkspaceMember,
  })
  transferOwnership(
    @CurrentWorkspace() workspace: WorkspaceDocument,
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: TransferOwnershipDto,
  ): Promise<WorkspaceMemberDocument> {
    return this.workspaces.transferOwnership(workspace, membership, dto.userId);
  }
}
