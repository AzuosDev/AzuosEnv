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
import { Types } from 'mongoose';
import { CursorPage } from '../../common/pagination/cursor';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import { CreateListDto, ListQueryDto, MoveListDto, UpdateListDto } from './dto/list.dto';
import { ReorderDto } from './dto/reorder.dto';
import { ListsService } from './lists.service';
import { permissionContextFrom } from './permission.service';
import { ListDocument } from './schemas/list.schema';
import { EffectiveStatuses } from './status-sets.service';

@ApiTags('lists')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/lists')
export class ListsController {
  constructor(private readonly lists: ListsService) {}

  @Post()
  @ApiCreatedResponse({ description: 'List criada.' })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateListDto,
  ): Promise<ListDocument> {
    return this.lists.create(permissionContextFrom(membership), dto);
  }

  @Get()
  @ApiOkResponse({ description: 'Lists visíveis para o usuário.' })
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: ListQueryDto,
  ): Promise<CursorPage<ListDocument>> {
    return this.lists.list(permissionContextFrom(membership), query);
  }

  @Get(':listId')
  @ApiOkResponse({ description: 'List.' })
  get(
    @CurrentMembership() membership: RequestMembership,
    @Param('listId', ParseObjectIdPipe) listId: Types.ObjectId,
  ): Promise<ListDocument> {
    return this.lists.get(permissionContextFrom(membership), listId);
  }

  @Get(':listId/statuses')
  @ApiOkResponse({ description: 'Statuses efetivos da List (list > folder > space).' })
  statuses(
    @CurrentMembership() membership: RequestMembership,
    @Param('listId', ParseObjectIdPipe) listId: Types.ObjectId,
  ): Promise<EffectiveStatuses> {
    return this.lists.statuses(permissionContextFrom(membership), listId);
  }

  @Patch(':listId')
  @ApiOkResponse({ description: 'List atualizada.' })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('listId', ParseObjectIdPipe) listId: Types.ObjectId,
    @Body() dto: UpdateListDto,
  ): Promise<ListDocument> {
    return this.lists.update(permissionContextFrom(membership), listId, dto);
  }

  @Post(':listId/move')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'List movida.' })
  move(
    @CurrentMembership() membership: RequestMembership,
    @Param('listId', ParseObjectIdPipe) listId: Types.ObjectId,
    @Body() dto: MoveListDto,
  ): Promise<ListDocument> {
    return this.lists.move(permissionContextFrom(membership), listId, dto);
  }

  @Post(':listId/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'List reordenada.' })
  reorder(
    @CurrentMembership() membership: RequestMembership,
    @Param('listId', ParseObjectIdPipe) listId: Types.ObjectId,
    @Body() dto: ReorderDto,
  ): Promise<ListDocument> {
    return this.lists.reorder(permissionContextFrom(membership), listId, dto);
  }

  @Post(':listId/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'List arquivada.' })
  archive(
    @CurrentMembership() membership: RequestMembership,
    @Param('listId', ParseObjectIdPipe) listId: Types.ObjectId,
  ): Promise<ListDocument> {
    return this.lists.archive(permissionContextFrom(membership), listId);
  }

  @Post(':listId/unarchive')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'List desarquivada.' })
  unarchive(
    @CurrentMembership() membership: RequestMembership,
    @Param('listId', ParseObjectIdPipe) listId: Types.ObjectId,
  ): Promise<ListDocument> {
    return this.lists.unarchive(permissionContextFrom(membership), listId);
  }

  @Post(':listId/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'List restaurada da lixeira.' })
  restore(
    @CurrentMembership() membership: RequestMembership,
    @Param('listId', ParseObjectIdPipe) listId: Types.ObjectId,
  ): Promise<ListDocument> {
    return this.lists.restore(permissionContextFrom(membership), listId);
  }

  @Delete(':listId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'List enviada para a lixeira.' })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('listId', ParseObjectIdPipe) listId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.lists.remove(permissionContextFrom(membership), listId);

    return { success: true };
  }
}
