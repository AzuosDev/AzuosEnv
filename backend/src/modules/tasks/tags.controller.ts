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
import { permissionContextFrom } from '../hierarchy/permission.service';
import { Roles } from '../workspaces/decorators/roles.decorator';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import { CreateTagDto, TagQueryDto, UpdateTagDto } from './dto/tag.dto';
import { TagDocument } from './schemas/tag.schema';
import { TagsService } from './tags.service';

@ApiTags('tags')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Post()
  @Roles('member')
  @ApiCreatedResponse({ description: 'Tag criada.' })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateTagDto,
  ): Promise<TagDocument> {
    return this.tags.create(permissionContextFrom(membership), dto);
  }

  @Get()
  @ApiOkResponse({ description: 'Tags dos Spaces visíveis.' })
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: TagQueryDto,
  ): Promise<CursorPage<TagDocument>> {
    return this.tags.list(permissionContextFrom(membership), query);
  }

  @Patch(':tagId')
  @ApiOkResponse({ description: 'Tag atualizada.' })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('tagId', ParseObjectIdPipe) tagId: Types.ObjectId,
    @Body() dto: UpdateTagDto,
  ): Promise<TagDocument> {
    return this.tags.update(permissionContextFrom(membership), tagId, dto);
  }

  @Delete(':tagId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Tag removida.' })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('tagId', ParseObjectIdPipe) tagId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.tags.remove(permissionContextFrom(membership), tagId);

    return { success: true };
  }
}
