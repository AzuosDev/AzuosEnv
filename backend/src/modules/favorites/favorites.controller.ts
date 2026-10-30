import {
  Body,
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
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CursorPage } from '../../common/pagination/cursor';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { ReorderDto } from '../hierarchy/dto/reorder.dto';
import { permissionContextFrom } from '../hierarchy/permission.service';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import { CreateFavoriteDto } from './dto/favorite.dto';
import { FavoriteItem, FavoritesService, RecentItemView } from './favorites.service';

@ApiTags('favorites')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Entidade favoritada para quem chamou.' })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateFavoriteDto,
  ): Promise<FavoriteItem> {
    return this.favorites.create(permissionContextFrom(membership), dto);
  }

  @Get()
  @ApiOkResponse({ description: 'Favoritos do usuário na ordem manual.' })
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: PaginationQueryDto,
  ): Promise<CursorPage<FavoriteItem>> {
    return this.favorites.list(permissionContextFrom(membership), query);
  }

  @Post(':favoriteId/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Favorito reposicionado.' })
  reorder(
    @CurrentMembership() membership: RequestMembership,
    @Param('favoriteId', ParseObjectIdPipe) favoriteId: Types.ObjectId,
    @Body() dto: ReorderDto,
  ): Promise<FavoriteItem> {
    return this.favorites.reorder(permissionContextFrom(membership), favoriteId, dto);
  }

  @Delete(':favoriteId')
  @ApiOkResponse({ description: 'Favorito removido.' })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('favoriteId', ParseObjectIdPipe) favoriteId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.favorites.remove(permissionContextFrom(membership), favoriteId);

    return { success: true };
  }
}

@ApiTags('favorites')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/me/recent')
export class RecentsController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  @ApiOkResponse({ description: 'Últimas tarefas e Lists abertas pelo usuário.' })
  recent(@CurrentMembership() membership: RequestMembership): Promise<{ items: RecentItemView[] }> {
    return this.favorites.recent(permissionContextFrom(membership));
  }
}
