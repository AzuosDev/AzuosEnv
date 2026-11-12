import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CursorPage } from '../../common/pagination/cursor';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { SuccessDto } from '../../common/dto/api-error.dto';
import { ApiPagedResponse } from '../../common/swagger/api-paged-response.decorator';
import { ApiWorkspaceParam } from '../../common/swagger/api-workspace-param.decorator';
import { Audit } from '../audit/audit.decorator';
import { permissionContextFrom } from '../hierarchy/permission.service';
import { Roles } from '../workspaces/decorators/roles.decorator';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import { RestoredEntityDto, TrashItemDto } from './dto/trash-item.dto';
import { TRASH_ENTITY_TYPES, TrashEntityType } from './trash-fields';
import { RestoredEntity, TrashItem, TrashService } from './trash.service';

function requireEntityType(value: string): TrashEntityType {
  if (!(TRASH_ENTITY_TYPES as readonly string[]).includes(value)) {
    throw new BadRequestException({
      code: 'INVALID_TRASH_ENTITY',
      message: 'Tipo de item inválido para a lixeira.',
    });
  }

  return value as TrashEntityType;
}

@ApiTags('trash')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@ApiWorkspaceParam()
@Controller('workspaces/:wsId/trash')
export class TrashController {
  constructor(private readonly trash: TrashService) {}

  @Get()
  @ApiPagedResponse(TrashItemDto, 'Itens excluídos nos últimos 30 dias.')
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: PaginationQueryDto,
  ): Promise<CursorPage<TrashItem>> {
    return this.trash.trash(permissionContextFrom(membership), query);
  }

  @Post(':entityType/:entityId/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Item restaurado da lixeira.', type: RestoredEntityDto })
  restore(
    @CurrentMembership() membership: RequestMembership,
    @Param('entityType') entityType: string,
    @Param('entityId', ParseObjectIdPipe) entityId: Types.ObjectId,
  ): Promise<RestoredEntity> {
    return this.trash.restore(
      permissionContextFrom(membership),
      requireEntityType(entityType),
      entityId,
    );
  }

  @Delete(':entityType/:entityId')
  @Audit('resource.purged', 'resource', 'entityId')
  @Roles('admin')
  @ApiOkResponse({
    description: 'Item apagado de vez, com tudo que ele contém.',
    type: SuccessDto,
  })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('entityType') entityType: string,
    @Param('entityId', ParseObjectIdPipe) entityId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.trash.remove(
      permissionContextFrom(membership),
      requireEntityType(entityType),
      entityId,
    );

    return { success: true };
  }
}

@ApiTags('trash')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@ApiWorkspaceParam()
@Controller('workspaces/:wsId/archived')
export class ArchivedController {
  constructor(private readonly trash: TrashService) {}

  @Get()
  @ApiPagedResponse(TrashItemDto, 'Spaces, Folders, Lists e tarefas arquivadas.')
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: PaginationQueryDto,
  ): Promise<CursorPage<TrashItem>> {
    return this.trash.archived(permissionContextFrom(membership), query);
  }
}
