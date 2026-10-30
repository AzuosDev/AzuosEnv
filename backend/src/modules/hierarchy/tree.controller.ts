import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import { permissionContextFrom } from './permission.service';
import { TreeService, WorkspaceTree } from './tree.service';

@ApiTags('tree')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/tree')
export class TreeController {
  constructor(private readonly tree: TreeService) {}

  @Get()
  @ApiOkResponse({ description: 'Árvore da sidebar filtrada por permissão.' })
  get(@CurrentMembership() membership: RequestMembership): Promise<WorkspaceTree> {
    return this.tree.build(permissionContextFrom(membership));
  }
}
