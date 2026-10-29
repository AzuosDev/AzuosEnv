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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CursorPage } from '../../common/pagination/cursor';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { CurrentMembership, CurrentWorkspace } from './decorators/workspace-context.decorator';
import { Roles } from './decorators/roles.decorator';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { TransferOwnershipDto } from './dto/member.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceGuard } from './guards/workspace.guard';
import { WorkspaceMemberDocument } from './schemas/workspace-member.schema';
import { WorkspaceDocument } from './schemas/workspace.schema';
import { RequestMembership } from './workspace-context';
import { WorkspacesService } from './workspaces.service';

@ApiTags('workspaces')
@ApiBearerAuth()
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Workspace criado; quem cria vira owner.' })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateWorkspaceDto,
  ): Promise<WorkspaceDocument> {
    return this.workspaces.create(userId, dto);
  }

  @Get()
  @ApiOkResponse({ description: 'Workspaces em que o usuário é membro ativo.' })
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
  @UseGuards(WorkspaceGuard)
  @Roles('admin')
  @ApiOkResponse({ description: 'Workspace atualizado.' })
  update(
    @CurrentWorkspace() workspace: WorkspaceDocument,
    @Body() dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceDocument> {
    return this.workspaces.update(workspace, dto);
  }

  @Delete(':wsId')
  @UseGuards(WorkspaceGuard)
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Workspace enviado para a lixeira.' })
  async remove(@CurrentWorkspace() workspace: WorkspaceDocument): Promise<{ success: true }> {
    await this.workspaces.softDelete(workspace);

    return { success: true };
  }

  @Post(':wsId/transfer-ownership')
  @UseGuards(WorkspaceGuard)
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Posse transferida; o antigo owner fica como admin.' })
  transferOwnership(
    @CurrentWorkspace() workspace: WorkspaceDocument,
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: TransferOwnershipDto,
  ): Promise<WorkspaceMemberDocument> {
    return this.workspaces.transferOwnership(workspace, membership, dto.userId);
  }
}
