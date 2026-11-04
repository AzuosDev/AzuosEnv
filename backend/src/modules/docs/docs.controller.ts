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
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { permissionContextFrom } from '../hierarchy/permission.service';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import { CommentDocument } from '../collaboration/schemas/comment.schema';
import { DocPagesService } from './doc-pages.service';
import { DocsService } from './docs.service';
import { PageCommentThread, PageCommentsService } from './page-comments.service';
import { CreateDocDto, DocQueryDto, ShareDocDto, UpdateDocDto } from './dto/doc.dto';
import {
  CreatePageCommentDto,
  CreatePageDto,
  MovePageDto,
  UpdatePageDto,
} from './dto/doc-page.dto';
import { DocDocument } from './schemas/doc.schema';
import { DocPageDocument } from './schemas/doc-page.schema';
import { DocPageVersionDocument } from './schemas/doc-page-version.schema';

interface ShareResponse {
  doc: DocDocument;
  /** Shown only when the link is created. */
  token: string | null;
  url: string | null;
}

@ApiTags('docs')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/docs')
export class DocsController {
  constructor(
    private readonly docs: DocsService,
    private readonly pages: DocPagesService,
  ) {}

  @Post()
  @ApiCreatedResponse({ description: 'Doc criado.' })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateDocDto,
  ): Promise<DocDocument> {
    return this.docs.create(permissionContextFrom(membership), dto);
  }

  @Get()
  @ApiOkResponse({ description: 'Hub de Docs por aba (recent, favorites, mine, all).' })
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: DocQueryDto,
  ): Promise<CursorPage<DocDocument>> {
    return this.docs.list(permissionContextFrom(membership), query);
  }

  @Get(':docId')
  @ApiOkResponse({ description: 'Doc.' })
  get(
    @CurrentMembership() membership: RequestMembership,
    @Param('docId', ParseObjectIdPipe) docId: Types.ObjectId,
  ): Promise<DocDocument> {
    return this.docs.get(permissionContextFrom(membership), docId);
  }

  @Patch(':docId')
  @ApiOkResponse({ description: 'Doc atualizado.' })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('docId', ParseObjectIdPipe) docId: Types.ObjectId,
    @Body() dto: UpdateDocDto,
  ): Promise<DocDocument> {
    return this.docs.update(permissionContextFrom(membership), docId, dto);
  }

  @Delete(':docId')
  @ApiOkResponse({ description: 'Doc enviado para a lixeira.' })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('docId', ParseObjectIdPipe) docId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.docs.remove(permissionContextFrom(membership), docId);

    return { success: true };
  }

  @Post(':docId/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Doc restaurado.' })
  restore(
    @CurrentMembership() membership: RequestMembership,
    @Param('docId', ParseObjectIdPipe) docId: Types.ObjectId,
  ): Promise<DocDocument> {
    return this.docs.restore(permissionContextFrom(membership), docId);
  }

  @Post(':docId/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Doc arquivado.' })
  archive(
    @CurrentMembership() membership: RequestMembership,
    @Param('docId', ParseObjectIdPipe) docId: Types.ObjectId,
  ): Promise<DocDocument> {
    return this.docs.setArchived(permissionContextFrom(membership), docId, true);
  }

  @Post(':docId/unarchive')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Doc desarquivado.' })
  unarchive(
    @CurrentMembership() membership: RequestMembership,
    @Param('docId', ParseObjectIdPipe) docId: Types.ObjectId,
  ): Promise<DocDocument> {
    return this.docs.setArchived(permissionContextFrom(membership), docId, false);
  }

  @Post(':docId/share')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Link público criado ou revogado.' })
  share(
    @CurrentMembership() membership: RequestMembership,
    @Param('docId', ParseObjectIdPipe) docId: Types.ObjectId,
    @Body() dto: ShareDocDto,
  ): Promise<ShareResponse> {
    return this.docs.share(permissionContextFrom(membership), docId, dto);
  }

  @Post(':docId/pages')
  @ApiCreatedResponse({ description: 'Página criada.' })
  createPage(
    @CurrentMembership() membership: RequestMembership,
    @Param('docId', ParseObjectIdPipe) docId: Types.ObjectId,
    @Body() dto: CreatePageDto,
  ): Promise<DocPageDocument> {
    return this.pages.create(permissionContextFrom(membership), docId, dto);
  }

  @Get(':docId/pages')
  @ApiOkResponse({ description: 'Páginas do Doc em ordem manual.' })
  listPages(
    @CurrentMembership() membership: RequestMembership,
    @Param('docId', ParseObjectIdPipe) docId: Types.ObjectId,
  ): Promise<{ items: DocPageDocument[] }> {
    return this.docs.tree(permissionContextFrom(membership), docId);
  }
}

@ApiTags('docs')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/pages')
export class DocPagesController {
  constructor(
    private readonly pages: DocPagesService,
    private readonly comments: PageCommentsService,
  ) {}

  @Get(':pageId')
  @ApiOkResponse({ description: 'Página.' })
  get(
    @CurrentMembership() membership: RequestMembership,
    @Param('pageId', ParseObjectIdPipe) pageId: Types.ObjectId,
  ): Promise<DocPageDocument> {
    return this.pages.get(permissionContextFrom(membership), pageId);
  }

  @Patch(':pageId')
  @ApiOkResponse({ description: 'Página salva; versão divergente responde 409.' })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('pageId', ParseObjectIdPipe) pageId: Types.ObjectId,
    @Body() dto: UpdatePageDto,
  ): Promise<DocPageDocument> {
    return this.pages.update(permissionContextFrom(membership), pageId, dto);
  }

  @Post(':pageId/move')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Página movida ou reordenada.' })
  move(
    @CurrentMembership() membership: RequestMembership,
    @Param('pageId', ParseObjectIdPipe) pageId: Types.ObjectId,
    @Body() dto: MovePageDto,
  ): Promise<DocPageDocument> {
    return this.pages.move(permissionContextFrom(membership), pageId, dto);
  }

  @Delete(':pageId')
  @ApiOkResponse({ description: 'Página excluída com as páginas aninhadas nela.' })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('pageId', ParseObjectIdPipe) pageId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.pages.remove(permissionContextFrom(membership), pageId);

    return { success: true };
  }

  @Post(':pageId/comments')
  @ApiCreatedResponse({ description: 'Comentário criado na página.' })
  createComment(
    @CurrentMembership() membership: RequestMembership,
    @Param('pageId', ParseObjectIdPipe) pageId: Types.ObjectId,
    @Body() dto: CreatePageCommentDto,
  ): Promise<CommentDocument> {
    return this.comments.create(permissionContextFrom(membership), pageId, dto);
  }

  @Get(':pageId/comments')
  @ApiOkResponse({ description: 'Comentários da página com as respostas.' })
  listComments(
    @CurrentMembership() membership: RequestMembership,
    @Param('pageId', ParseObjectIdPipe) pageId: Types.ObjectId,
    @Query() query: PaginationQueryDto,
  ): Promise<CursorPage<PageCommentThread>> {
    return this.comments.list(permissionContextFrom(membership), pageId, query);
  }

  @Get(':pageId/versions')
  @ApiOkResponse({ description: 'Versões da página, mais novas primeiro.' })
  versions(
    @CurrentMembership() membership: RequestMembership,
    @Param('pageId', ParseObjectIdPipe) pageId: Types.ObjectId,
    @Query() query: PaginationQueryDto,
  ): Promise<CursorPage<DocPageVersionDocument>> {
    return this.pages.listVersions(permissionContextFrom(membership), pageId, query);
  }

  @Post(':pageId/versions/:versionId/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Página restaurada para a versão.' })
  restoreVersion(
    @CurrentMembership() membership: RequestMembership,
    @Param('pageId', ParseObjectIdPipe) pageId: Types.ObjectId,
    @Param('versionId', ParseObjectIdPipe) versionId: Types.ObjectId,
  ): Promise<DocPageDocument> {
    return this.pages.restoreVersion(permissionContextFrom(membership), pageId, versionId);
  }
}
