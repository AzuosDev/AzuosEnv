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
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { permissionContextFrom } from '../hierarchy/permission.service';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import { CommentThread, CommentsService } from './comments.service';
import {
  AssignCommentDto,
  AssignedCommentsQueryDto,
  CreateCommentDto,
  ReactionDto,
  UpdateCommentDto,
} from './dto/comment.dto';
import { CommentDocument } from './schemas/comment.schema';

@ApiTags('comments')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/tasks/:idOrCustomId/comments')
export class TaskCommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Comentário criado na tarefa.' })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Param('idOrCustomId') idOrCustomId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentDocument> {
    return this.comments.create(permissionContextFrom(membership), idOrCustomId, dto);
  }

  @Get()
  @ApiOkResponse({ description: 'Threads da tarefa: comentário raiz e respostas.' })
  list(
    @CurrentMembership() membership: RequestMembership,
    @Param('idOrCustomId') idOrCustomId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<CursorPage<CommentThread>> {
    return this.comments.list(permissionContextFrom(membership), idOrCustomId, query);
  }
}

@ApiTags('comments')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Patch(':commentId')
  @ApiOkResponse({ description: 'Comentário editado (só o autor).' })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('commentId', ParseObjectIdPipe) commentId: Types.ObjectId,
    @Body() dto: UpdateCommentDto,
  ): Promise<CommentDocument> {
    return this.comments.update(permissionContextFrom(membership), commentId, dto);
  }

  @Post(':commentId/reactions')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Reação alternada no comentário.' })
  react(
    @CurrentMembership() membership: RequestMembership,
    @Param('commentId', ParseObjectIdPipe) commentId: Types.ObjectId,
    @Body() dto: ReactionDto,
  ): Promise<CommentDocument> {
    return this.comments.react(permissionContextFrom(membership), commentId, dto);
  }

  @Post(':commentId/assign')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Responsável do comentário definido ou removido.' })
  assign(
    @CurrentMembership() membership: RequestMembership,
    @Param('commentId', ParseObjectIdPipe) commentId: Types.ObjectId,
    @Body() dto: AssignCommentDto,
  ): Promise<CommentDocument> {
    return this.comments.assign(permissionContextFrom(membership), commentId, dto);
  }

  @Post(':commentId/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Comentário resolvido.' })
  resolve(
    @CurrentMembership() membership: RequestMembership,
    @Param('commentId', ParseObjectIdPipe) commentId: Types.ObjectId,
  ): Promise<CommentDocument> {
    return this.comments.setResolved(permissionContextFrom(membership), commentId, true);
  }

  @Post(':commentId/unresolve')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Comentário reaberto.' })
  unresolve(
    @CurrentMembership() membership: RequestMembership,
    @Param('commentId', ParseObjectIdPipe) commentId: Types.ObjectId,
  ): Promise<CommentDocument> {
    return this.comments.setResolved(permissionContextFrom(membership), commentId, false);
  }

  @Delete(':commentId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Comentário removido.' })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('commentId', ParseObjectIdPipe) commentId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.comments.remove(permissionContextFrom(membership), commentId);

    return { success: true };
  }
}

@ApiTags('comments')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId')
export class CommentInboxController {
  constructor(private readonly comments: CommentsService) {}

  @Get('assigned-comments')
  @ApiOkResponse({ description: 'Comentários atribuídos ao usuário autenticado.' })
  assigned(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: AssignedCommentsQueryDto,
  ): Promise<CursorPage<CommentDocument>> {
    return this.comments.assigned(permissionContextFrom(membership), query);
  }

  @Get('replies')
  @ApiOkResponse({ description: 'Respostas de outras pessoas aos meus comentários.' })
  replies(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: PaginationQueryDto,
  ): Promise<CursorPage<CommentDocument>> {
    return this.comments.replies(permissionContextFrom(membership), query);
  }
}
