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
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import { CreateFolderDto, FolderQueryDto, MoveFolderDto, UpdateFolderDto } from './dto/folder.dto';
import { ReorderDto } from './dto/reorder.dto';
import { FoldersService } from './folders.service';
import { permissionContextFrom } from './permission.service';
import { Folder, FolderDocument } from './schemas/folder.schema';

@ApiTags('folders')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/folders')
export class FoldersController {
  constructor(private readonly folders: FoldersService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Folder criado.', type: Folder })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateFolderDto,
  ): Promise<FolderDocument> {
    return this.folders.create(permissionContextFrom(membership), dto);
  }

  @Get()
  @ApiPagedResponse(Folder, 'Folders visíveis para o usuário.')
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: FolderQueryDto,
  ): Promise<CursorPage<FolderDocument>> {
    return this.folders.list(permissionContextFrom(membership), query);
  }

  @Get(':folderId')
  @ApiOkResponse({ description: 'Folder.', type: Folder })
  get(
    @CurrentMembership() membership: RequestMembership,
    @Param('folderId', ParseObjectIdPipe) folderId: Types.ObjectId,
  ): Promise<FolderDocument> {
    return this.folders.get(permissionContextFrom(membership), folderId);
  }

  @Patch(':folderId')
  @ApiOkResponse({ description: 'Folder atualizado.', type: Folder })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('folderId', ParseObjectIdPipe) folderId: Types.ObjectId,
    @Body() dto: UpdateFolderDto,
  ): Promise<FolderDocument> {
    return this.folders.update(permissionContextFrom(membership), folderId, dto);
  }

  @Post(':folderId/move')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Folder movido.', type: Folder })
  move(
    @CurrentMembership() membership: RequestMembership,
    @Param('folderId', ParseObjectIdPipe) folderId: Types.ObjectId,
    @Body() dto: MoveFolderDto,
  ): Promise<FolderDocument> {
    return this.folders.move(permissionContextFrom(membership), folderId, dto);
  }

  @Post(':folderId/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Folder reordenado.', type: Folder })
  reorder(
    @CurrentMembership() membership: RequestMembership,
    @Param('folderId', ParseObjectIdPipe) folderId: Types.ObjectId,
    @Body() dto: ReorderDto,
  ): Promise<FolderDocument> {
    return this.folders.reorder(permissionContextFrom(membership), folderId, dto);
  }

  @Post(':folderId/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Folder arquivado.', type: Folder })
  archive(
    @CurrentMembership() membership: RequestMembership,
    @Param('folderId', ParseObjectIdPipe) folderId: Types.ObjectId,
  ): Promise<FolderDocument> {
    return this.folders.archive(permissionContextFrom(membership), folderId);
  }

  @Post(':folderId/unarchive')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Folder desarquivado.', type: Folder })
  unarchive(
    @CurrentMembership() membership: RequestMembership,
    @Param('folderId', ParseObjectIdPipe) folderId: Types.ObjectId,
  ): Promise<FolderDocument> {
    return this.folders.unarchive(permissionContextFrom(membership), folderId);
  }

  @Post(':folderId/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Folder restaurado da lixeira.', type: Folder })
  restore(
    @CurrentMembership() membership: RequestMembership,
    @Param('folderId', ParseObjectIdPipe) folderId: Types.ObjectId,
  ): Promise<FolderDocument> {
    return this.folders.restore(permissionContextFrom(membership), folderId);
  }

  @Delete(':folderId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Folder enviado para a lixeira.' })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('folderId', ParseObjectIdPipe) folderId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.folders.remove(permissionContextFrom(membership), folderId);

    return { success: true };
  }
}
