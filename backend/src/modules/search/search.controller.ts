import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { permissionContextFrom } from '../hierarchy/permission.service';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchResult, SearchService } from './search.service';

@ApiTags('search')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @ApiOkResponse({ description: 'Busca global do workspace, filtrada por permissão.' })
  run(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: SearchQueryDto,
  ): Promise<SearchResult> {
    return this.search.search(permissionContextFrom(membership), query);
  }
}
