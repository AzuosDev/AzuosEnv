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
import { permissionContextFrom } from '../hierarchy/permission.service';
import {
  CurrentMembership,
  CurrentWorkspace,
} from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import { WorkspaceDocument } from '../workspaces/schemas/workspace.schema';
import {
  CreateWhiteboardDto,
  ElementToTaskDto,
  PatchWhiteboardElementsDto,
  UpdateWhiteboardDto,
  WhiteboardQueryDto,
} from './dto/whiteboard.dto';
import { Whiteboard, WhiteboardDocument } from './schemas/whiteboard.schema';
import { ElementTaskResult, WhiteboardsService } from './whiteboards.service';

@ApiTags('whiteboards')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/whiteboards')
export class WhiteboardsController {
  constructor(private readonly whiteboards: WhiteboardsService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Quadro criado.', type: Whiteboard })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateWhiteboardDto,
  ): Promise<WhiteboardDocument> {
    return this.whiteboards.create(permissionContextFrom(membership), dto);
  }

  @Get()
  @ApiPagedResponse(Whiteboard, 'Quadros visíveis, mais novos primeiro.')
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: WhiteboardQueryDto,
  ): Promise<CursorPage<WhiteboardDocument>> {
    return this.whiteboards.list(permissionContextFrom(membership), query);
  }

  @Get(':whiteboardId')
  @ApiOkResponse({ description: 'Quadro com os elementos e a versão atual.', type: Whiteboard })
  get(
    @CurrentMembership() membership: RequestMembership,
    @Param('whiteboardId', ParseObjectIdPipe) whiteboardId: Types.ObjectId,
  ): Promise<WhiteboardDocument> {
    return this.whiteboards.get(permissionContextFrom(membership), whiteboardId);
  }

  @Patch(':whiteboardId')
  @ApiOkResponse({ description: 'Quadro renomeado.', type: Whiteboard })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('whiteboardId', ParseObjectIdPipe) whiteboardId: Types.ObjectId,
    @Body() dto: UpdateWhiteboardDto,
  ): Promise<WhiteboardDocument> {
    return this.whiteboards.update(permissionContextFrom(membership), whiteboardId, dto);
  }

  @Patch(':whiteboardId/elements')
  @ApiOkResponse({
    description: 'Lote aplicado; divergência de versão responde 409.',
    type: Whiteboard,
  })
  patchElements(
    @CurrentMembership() membership: RequestMembership,
    @Param('whiteboardId', ParseObjectIdPipe) whiteboardId: Types.ObjectId,
    @Body() dto: PatchWhiteboardElementsDto,
  ): Promise<WhiteboardDocument> {
    return this.whiteboards.patchElements(permissionContextFrom(membership), whiteboardId, dto);
  }

  @Post(':whiteboardId/elements/:elementId/to-task')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ description: 'Elemento convertido em tarefa.' })
  toTask(
    @CurrentMembership() membership: RequestMembership,
    @CurrentWorkspace() workspace: WorkspaceDocument,
    @Param('whiteboardId', ParseObjectIdPipe) whiteboardId: Types.ObjectId,
    @Param('elementId') elementId: string,
    @Body() dto: ElementToTaskDto,
  ): Promise<ElementTaskResult> {
    return this.whiteboards.elementToTask(
      permissionContextFrom(membership),
      whiteboardId,
      elementId,
      workspace.taskPrefix,
      dto,
    );
  }

  @Delete(':whiteboardId')
  @ApiOkResponse({ description: 'Quadro enviado para a lixeira.' })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('whiteboardId', ParseObjectIdPipe) whiteboardId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.whiteboards.remove(permissionContextFrom(membership), whiteboardId);

    return { success: true };
  }

  @Post(':whiteboardId/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Quadro restaurado.', type: Whiteboard })
  restore(
    @CurrentMembership() membership: RequestMembership,
    @Param('whiteboardId', ParseObjectIdPipe) whiteboardId: Types.ObjectId,
  ): Promise<WhiteboardDocument> {
    return this.whiteboards.restore(permissionContextFrom(membership), whiteboardId);
  }
}
