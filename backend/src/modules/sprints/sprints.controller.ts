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
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { List, ListDocument } from '../hierarchy/schemas/list.schema';
import { permissionContextFrom } from '../hierarchy/permission.service';
import { Roles } from '../workspaces/decorators/roles.decorator';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import {
  CreateSprintDto,
  CreateSprintFolderDto,
  SprintFolderQueryDto,
  UpdateSprintFolderDto,
} from './dto/sprint.dto';
import { SprintFolder, SprintFolderDocument } from './schemas/sprint-folder.schema';
import { CloseSprintResult, SprintFolderView, SprintsService } from './sprints.service';

@ApiTags('sprints')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/sprint-folders')
export class SprintFoldersController {
  constructor(private readonly sprints: SprintsService) {}

  @Post()
  @Roles('member')
  @ApiCreatedResponse({ description: 'Pasta de sprints criada com a primeira sprint.' })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateSprintFolderDto,
  ): Promise<SprintFolderView> {
    return this.sprints.createFolder(permissionContextFrom(membership), dto);
  }

  @Get()
  @ApiPagedResponse(SprintFolder, 'Pastas de sprints visíveis.')
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: SprintFolderQueryDto,
  ): Promise<CursorPage<SprintFolderDocument>> {
    return this.sprints.listFolders(permissionContextFrom(membership), query);
  }

  @Get(':sprintFolderId')
  @ApiOkResponse({ description: 'Pasta de sprints com as sprints em ordem.' })
  get(
    @CurrentMembership() membership: RequestMembership,
    @Param('sprintFolderId', ParseObjectIdPipe) sprintFolderId: Types.ObjectId,
  ): Promise<SprintFolderView> {
    return this.sprints.getFolder(permissionContextFrom(membership), sprintFolderId);
  }

  @Patch(':sprintFolderId')
  @Roles('member')
  @ApiOkResponse({ description: 'Pasta de sprints atualizada.', type: SprintFolder })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('sprintFolderId', ParseObjectIdPipe) sprintFolderId: Types.ObjectId,
    @Body() dto: UpdateSprintFolderDto,
  ): Promise<SprintFolderDocument> {
    return this.sprints.updateFolder(permissionContextFrom(membership), sprintFolderId, dto);
  }

  @Delete(':sprintFolderId')
  @Roles('member')
  @ApiOkResponse({ description: 'Pasta de sprints excluída com o Folder dela.' })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('sprintFolderId', ParseObjectIdPipe) sprintFolderId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.sprints.removeFolder(permissionContextFrom(membership), sprintFolderId);

    return { success: true };
  }

  @Post(':sprintFolderId/sprints')
  @Roles('member')
  @ApiCreatedResponse({ description: 'Próxima sprint criada na pasta.', type: List })
  createSprint(
    @CurrentMembership() membership: RequestMembership,
    @Param('sprintFolderId', ParseObjectIdPipe) sprintFolderId: Types.ObjectId,
    @Body() dto: CreateSprintDto,
  ): Promise<ListDocument> {
    return this.sprints.createSprint(permissionContextFrom(membership), sprintFolderId, dto);
  }
}

@ApiTags('sprints')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/sprints')
export class SprintsController {
  constructor(private readonly sprints: SprintsService) {}

  @Get(':sprintId')
  @ApiOkResponse({ description: 'Sprint (a List com as datas do ciclo).', type: List })
  get(
    @CurrentMembership() membership: RequestMembership,
    @Param('sprintId', ParseObjectIdPipe) sprintId: Types.ObjectId,
  ): Promise<ListDocument> {
    return this.sprints.getSprint(permissionContextFrom(membership), sprintId);
  }

  @Post(':sprintId/close')
  @Roles('member')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Sprint fechada; as pendências vão para a próxima.' })
  close(
    @CurrentMembership() membership: RequestMembership,
    @Param('sprintId', ParseObjectIdPipe) sprintId: Types.ObjectId,
  ): Promise<CloseSprintResult> {
    return this.sprints.closeSprint(permissionContextFrom(membership), sprintId);
  }
}
