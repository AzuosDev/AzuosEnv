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
import { ApiWorkspaceParam } from '../../common/swagger/api-workspace-param.decorator';
import { SuccessDto } from '../../common/dto/api-error.dto';
import { Types } from 'mongoose';
import { CursorPage } from '../../common/pagination/cursor';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import { EffectiveStatusesDto } from './dto/effective-statuses.dto';
import { CreateListDto, ListQueryDto, MoveListDto, UpdateListDto } from './dto/list.dto';
import { ReorderDto } from './dto/reorder.dto';
import { ListsService } from './lists.service';
import { permissionContextFrom } from './permission.service';
import { List, ListDocument } from './schemas/list.schema';
import { EffectiveStatuses } from './status-sets.service';

@ApiTags('lists')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@ApiWorkspaceParam()
@Controller('workspaces/:wsId/lists')
export class ListsController {
  constructor(private readonly lists: ListsService) {}

  @Post()
  @ApiCreatedResponse({ description: 'List criada.', type: List })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateListDto,
  ): Promise<ListDocument> {
    return this.lists.create(permissionContextFrom(membership), dto);
  }

  @Get()
  @ApiPagedResponse(List, 'Lists visíveis para o usuário.')
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: ListQueryDto,
  ): Promise<CursorPage<ListDocument>> {
    return this.lists.list(permissionContextFrom(membership), query);
  }

  @Get(':listId')
  @ApiOkResponse({ description: 'List.', type: List })
  get(
    @CurrentMembership() membership: RequestMembership,
    @Param('listId', ParseObjectIdPipe) listId: Types.ObjectId,
  ): Promise<ListDocument> {
    return this.lists.get(permissionContextFrom(membership), listId);
  }

  @Get(':listId/statuses')
  @ApiOkResponse({
    description: 'Statuses efetivos da List (list > folder > space).',
    type: EffectiveStatusesDto,
  })
  statuses(
    @CurrentMembership() membership: RequestMembership,
    @Param('listId', ParseObjectIdPipe) listId: Types.ObjectId,
  ): Promise<EffectiveStatuses> {
    return this.lists.statuses(permissionContextFrom(membership), listId);
  }

  @Patch(':listId')
  @ApiOkResponse({ description: 'List atualizada.', type: List })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('listId', ParseObjectIdPipe) listId: Types.ObjectId,
    @Body() dto: UpdateListDto,
  ): Promise<ListDocument> {
    return this.lists.update(permissionContextFrom(membership), listId, dto);
  }

  @Post(':listId/move')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'List movida.', type: List })
  move(
    @CurrentMembership() membership: RequestMembership,
    @Param('listId', ParseObjectIdPipe) listId: Types.ObjectId,
    @Body() dto: MoveListDto,
  ): Promise<ListDocument> {
    return this.lists.move(permissionContextFrom(membership), listId, dto);
  }

  @Post(':listId/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'List reordenada.', type: List })
  reorder(
    @CurrentMembership() membership: RequestMembership,
    @Param('listId', ParseObjectIdPipe) listId: Types.ObjectId,
    @Body() dto: ReorderDto,
  ): Promise<ListDocument> {
    return this.lists.reorder(permissionContextFrom(membership), listId, dto);
  }

  @Post(':listId/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'List arquivada.', type: List })
  archive(
    @CurrentMembership() membership: RequestMembership,
    @Param('listId', ParseObjectIdPipe) listId: Types.ObjectId,
  ): Promise<ListDocument> {
    return this.lists.archive(permissionContextFrom(membership), listId);
  }

  @Post(':listId/unarchive')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'List desarquivada.', type: List })
  unarchive(
    @CurrentMembership() membership: RequestMembership,
    @Param('listId', ParseObjectIdPipe) listId: Types.ObjectId,
  ): Promise<ListDocument> {
    return this.lists.unarchive(permissionContextFrom(membership), listId);
  }

  @Post(':listId/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'List restaurada da lixeira.', type: List })
  restore(
    @CurrentMembership() membership: RequestMembership,
    @Param('listId', ParseObjectIdPipe) listId: Types.ObjectId,
  ): Promise<ListDocument> {
    return this.lists.restore(permissionContextFrom(membership), listId);
  }

  @Delete(':listId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'List enviada para a lixeira.', type: SuccessDto })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('listId', ParseObjectIdPipe) listId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.lists.remove(permissionContextFrom(membership), listId);

    return { success: true };
  }
}
