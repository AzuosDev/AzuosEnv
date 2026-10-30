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
import { Roles } from '../workspaces/decorators/roles.decorator';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import { ReorderDto } from './dto/reorder.dto';
import { CreateSpaceDto, SpaceQueryDto, UpdateSpaceDto } from './dto/space.dto';
import { permissionContextFrom } from './permission.service';
import { SpaceDocument } from './schemas/space.schema';
import { SpacesService } from './spaces.service';

@ApiTags('spaces')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/spaces')
export class SpacesController {
  constructor(private readonly spaces: SpacesService) {}

  @Post()
  @Roles('member')
  @ApiCreatedResponse({ description: 'Space criado.' })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateSpaceDto,
  ): Promise<SpaceDocument> {
    return this.spaces.create(permissionContextFrom(membership), dto);
  }

  @Get()
  @ApiOkResponse({ description: 'Spaces visíveis para o usuário.' })
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: SpaceQueryDto,
  ): Promise<CursorPage<SpaceDocument>> {
    return this.spaces.list(permissionContextFrom(membership), query);
  }

  @Get(':spaceId')
  @ApiOkResponse({ description: 'Space.' })
  get(
    @CurrentMembership() membership: RequestMembership,
    @Param('spaceId', ParseObjectIdPipe) spaceId: Types.ObjectId,
  ): Promise<SpaceDocument> {
    return this.spaces.get(permissionContextFrom(membership), spaceId);
  }

  @Patch(':spaceId')
  @ApiOkResponse({ description: 'Space atualizado.' })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('spaceId', ParseObjectIdPipe) spaceId: Types.ObjectId,
    @Body() dto: UpdateSpaceDto,
  ): Promise<SpaceDocument> {
    return this.spaces.update(permissionContextFrom(membership), spaceId, dto);
  }

  @Post(':spaceId/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Space reordenado.' })
  reorder(
    @CurrentMembership() membership: RequestMembership,
    @Param('spaceId', ParseObjectIdPipe) spaceId: Types.ObjectId,
    @Body() dto: ReorderDto,
  ): Promise<SpaceDocument> {
    return this.spaces.reorder(permissionContextFrom(membership), spaceId, dto);
  }

  @Post(':spaceId/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Space arquivado.' })
  archive(
    @CurrentMembership() membership: RequestMembership,
    @Param('spaceId', ParseObjectIdPipe) spaceId: Types.ObjectId,
  ): Promise<SpaceDocument> {
    return this.spaces.archive(permissionContextFrom(membership), spaceId);
  }

  @Post(':spaceId/unarchive')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Space desarquivado.' })
  unarchive(
    @CurrentMembership() membership: RequestMembership,
    @Param('spaceId', ParseObjectIdPipe) spaceId: Types.ObjectId,
  ): Promise<SpaceDocument> {
    return this.spaces.unarchive(permissionContextFrom(membership), spaceId);
  }

  @Post(':spaceId/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Space restaurado da lixeira.' })
  restore(
    @CurrentMembership() membership: RequestMembership,
    @Param('spaceId', ParseObjectIdPipe) spaceId: Types.ObjectId,
  ): Promise<SpaceDocument> {
    return this.spaces.restore(permissionContextFrom(membership), spaceId);
  }

  @Delete(':spaceId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Space enviado para a lixeira.' })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('spaceId', ParseObjectIdPipe) spaceId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.spaces.remove(permissionContextFrom(membership), spaceId);

    return { success: true };
  }
}
