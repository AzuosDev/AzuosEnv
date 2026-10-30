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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { ReorderDto } from '../hierarchy/dto/reorder.dto';
import { permissionContextFrom } from '../hierarchy/permission.service';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import { ChecklistsService } from './checklists.service';
import {
  CreateChecklistDto,
  CreateChecklistItemDto,
  UpdateChecklistDto,
  UpdateChecklistItemDto,
} from './dto/checklist.dto';
import { ChecklistDocument } from './schemas/checklist.schema';

@ApiTags('checklists')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/tasks/:idOrCustomId/checklists')
export class TaskChecklistsController {
  constructor(private readonly checklists: ChecklistsService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Checklist criada na tarefa.' })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Param('idOrCustomId') idOrCustomId: string,
    @Body() dto: CreateChecklistDto,
  ): Promise<ChecklistDocument> {
    return this.checklists.create(permissionContextFrom(membership), idOrCustomId, dto);
  }

  @Get()
  @ApiOkResponse({ description: 'Checklists da tarefa, em ordem manual.' })
  list(
    @CurrentMembership() membership: RequestMembership,
    @Param('idOrCustomId') idOrCustomId: string,
  ): Promise<ChecklistDocument[]> {
    return this.checklists.list(permissionContextFrom(membership), idOrCustomId);
  }
}

@ApiTags('checklists')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/checklists')
export class ChecklistsController {
  constructor(private readonly checklists: ChecklistsService) {}

  @Patch(':checklistId')
  @ApiOkResponse({ description: 'Checklist atualizada.' })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('checklistId', ParseObjectIdPipe) checklistId: Types.ObjectId,
    @Body() dto: UpdateChecklistDto,
  ): Promise<ChecklistDocument> {
    return this.checklists.update(permissionContextFrom(membership), checklistId, dto);
  }

  @Post(':checklistId/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Checklist reordenada na tarefa.' })
  reorder(
    @CurrentMembership() membership: RequestMembership,
    @Param('checklistId', ParseObjectIdPipe) checklistId: Types.ObjectId,
    @Body() dto: ReorderDto,
  ): Promise<ChecklistDocument> {
    return this.checklists.reorder(permissionContextFrom(membership), checklistId, dto);
  }

  @Delete(':checklistId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Checklist removida.' })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('checklistId', ParseObjectIdPipe) checklistId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.checklists.remove(permissionContextFrom(membership), checklistId);

    return { success: true };
  }

  @Post(':checklistId/items')
  @ApiCreatedResponse({ description: 'Item adicionado à checklist.' })
  addItem(
    @CurrentMembership() membership: RequestMembership,
    @Param('checklistId', ParseObjectIdPipe) checklistId: Types.ObjectId,
    @Body() dto: CreateChecklistItemDto,
  ): Promise<ChecklistDocument> {
    return this.checklists.addItem(permissionContextFrom(membership), checklistId, dto);
  }

  @Patch(':checklistId/items/:itemId')
  @ApiOkResponse({ description: 'Item atualizado.' })
  updateItem(
    @CurrentMembership() membership: RequestMembership,
    @Param('checklistId', ParseObjectIdPipe) checklistId: Types.ObjectId,
    @Param('itemId', ParseObjectIdPipe) itemId: Types.ObjectId,
    @Body() dto: UpdateChecklistItemDto,
  ): Promise<ChecklistDocument> {
    return this.checklists.updateItem(permissionContextFrom(membership), checklistId, itemId, dto);
  }

  @Post(':checklistId/items/:itemId/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Item reordenado entre os irmãos.' })
  reorderItem(
    @CurrentMembership() membership: RequestMembership,
    @Param('checklistId', ParseObjectIdPipe) checklistId: Types.ObjectId,
    @Param('itemId', ParseObjectIdPipe) itemId: Types.ObjectId,
    @Body() dto: ReorderDto,
  ): Promise<ChecklistDocument> {
    return this.checklists.reorderItem(permissionContextFrom(membership), checklistId, itemId, dto);
  }

  @Delete(':checklistId/items/:itemId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Item e subitens removidos.' })
  removeItem(
    @CurrentMembership() membership: RequestMembership,
    @Param('checklistId', ParseObjectIdPipe) checklistId: Types.ObjectId,
    @Param('itemId', ParseObjectIdPipe) itemId: Types.ObjectId,
  ): Promise<ChecklistDocument> {
    return this.checklists.removeItem(permissionContextFrom(membership), checklistId, itemId);
  }
}
