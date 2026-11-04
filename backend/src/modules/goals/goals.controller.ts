import {
  Body,
  Controller,
  Delete,
  Get,
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
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { permissionContextFrom } from '../hierarchy/permission.service';
import { Roles } from '../workspaces/decorators/roles.decorator';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import {
  CreateGoalDto,
  CreateGoalFolderDto,
  GoalQueryDto,
  UpdateGoalDto,
  UpdateGoalFolderDto,
} from './dto/goal.dto';
import { CreateTargetDto, UpdateTargetDto } from './dto/target.dto';
import { GoalFoldersService } from './goal-folders.service';
import { GoalView, GoalsService } from './goals.service';
import { GoalFolder, GoalFolderDocument } from './schemas/goal-folder.schema';
import { TargetDocument } from './schemas/target.schema';
import { TargetsService } from './targets.service';

interface TargetResponse {
  target: TargetDocument;
  progress: number;
}

@ApiTags('goals')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/goal-folders')
export class GoalFoldersController {
  constructor(private readonly folders: GoalFoldersService) {}

  @Post()
  @Roles('member')
  @ApiCreatedResponse({ description: 'Pasta de metas criada.', type: GoalFolder })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateGoalFolderDto,
  ): Promise<GoalFolderDocument> {
    return this.folders.create(permissionContextFrom(membership), dto);
  }

  @Get()
  @ApiPagedResponse(GoalFolder, 'Pastas de metas do workspace.')
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: PaginationQueryDto,
  ): Promise<CursorPage<GoalFolderDocument>> {
    return this.folders.list(permissionContextFrom(membership), query);
  }

  @Patch(':folderId')
  @Roles('member')
  @ApiOkResponse({ description: 'Pasta atualizada.', type: GoalFolder })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('folderId', ParseObjectIdPipe) folderId: Types.ObjectId,
    @Body() dto: UpdateGoalFolderDto,
  ): Promise<GoalFolderDocument> {
    return this.folders.update(permissionContextFrom(membership), folderId, dto);
  }

  @Delete(':folderId')
  @Roles('member')
  @ApiOkResponse({ description: 'Pasta excluída; as metas voltam para a raiz.' })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('folderId', ParseObjectIdPipe) folderId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.folders.remove(permissionContextFrom(membership), folderId);

    return { success: true };
  }
}

@ApiTags('goals')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/goals')
export class GoalsController {
  constructor(
    private readonly goals: GoalsService,
    private readonly targets: TargetsService,
  ) {}

  @Post()
  @Roles('member')
  @ApiCreatedResponse({ description: 'Meta criada.' })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateGoalDto,
  ): Promise<unknown> {
    return this.goals.create(permissionContextFrom(membership), dto);
  }

  @Get()
  @ApiOkResponse({ description: 'Metas visíveis com o progresso de cada uma.' })
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: GoalQueryDto,
  ): Promise<CursorPage<GoalView>> {
    return this.goals.list(permissionContextFrom(membership), query);
  }

  @Get(':goalId')
  @ApiOkResponse({ description: 'Meta com os alvos e o progresso.' })
  get(
    @CurrentMembership() membership: RequestMembership,
    @Param('goalId', ParseObjectIdPipe) goalId: Types.ObjectId,
  ): Promise<GoalView> {
    return this.goals.get(permissionContextFrom(membership), goalId);
  }

  @Patch(':goalId')
  @Roles('member')
  @ApiOkResponse({ description: 'Meta atualizada.' })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('goalId', ParseObjectIdPipe) goalId: Types.ObjectId,
    @Body() dto: UpdateGoalDto,
  ): Promise<GoalView> {
    return this.goals.update(permissionContextFrom(membership), goalId, dto);
  }

  @Delete(':goalId')
  @Roles('member')
  @ApiOkResponse({ description: 'Meta excluída com os alvos dela.' })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('goalId', ParseObjectIdPipe) goalId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.goals.remove(permissionContextFrom(membership), goalId);

    return { success: true };
  }

  @Post(':goalId/targets')
  @Roles('member')
  @ApiCreatedResponse({ description: 'Alvo criado na meta.' })
  async createTarget(
    @CurrentMembership() membership: RequestMembership,
    @Param('goalId', ParseObjectIdPipe) goalId: Types.ObjectId,
    @Body() dto: CreateTargetDto,
  ): Promise<TargetResponse> {
    const ctx = permissionContextFrom(membership);
    const goal = await this.goals.requireGoal(ctx, goalId, true);
    const target = await this.targets.create(ctx, goal, dto);

    return { target, progress: this.goals.percentOf(target) };
  }

  @Get(':goalId/targets')
  @ApiOkResponse({ description: 'Alvos da meta.' })
  async listTargets(
    @CurrentMembership() membership: RequestMembership,
    @Param('goalId', ParseObjectIdPipe) goalId: Types.ObjectId,
  ): Promise<{ items: TargetResponse[] }> {
    const ctx = permissionContextFrom(membership);
    const goal = await this.goals.requireGoal(ctx, goalId);
    const targets = await this.targets.ofGoal(ctx.workspaceId, goal._id);

    return {
      items: targets.map((target) => ({ target, progress: this.goals.percentOf(target) })),
    };
  }

  @Patch(':goalId/targets/:targetId')
  @Roles('member')
  @ApiOkResponse({ description: 'Alvo atualizado.' })
  async updateTarget(
    @CurrentMembership() membership: RequestMembership,
    @Param('goalId', ParseObjectIdPipe) goalId: Types.ObjectId,
    @Param('targetId', ParseObjectIdPipe) targetId: Types.ObjectId,
    @Body() dto: UpdateTargetDto,
  ): Promise<TargetResponse> {
    const ctx = permissionContextFrom(membership);
    const goal = await this.goals.requireGoal(ctx, goalId, true);
    const target = await this.targets.update(ctx, targetId, goal, dto);

    return { target, progress: this.goals.percentOf(target) };
  }

  @Delete(':goalId/targets/:targetId')
  @Roles('member')
  @ApiOkResponse({ description: 'Alvo excluído.' })
  async removeTarget(
    @CurrentMembership() membership: RequestMembership,
    @Param('goalId', ParseObjectIdPipe) goalId: Types.ObjectId,
    @Param('targetId', ParseObjectIdPipe) targetId: Types.ObjectId,
  ): Promise<{ success: true }> {
    const ctx = permissionContextFrom(membership);
    const goal = await this.goals.requireGoal(ctx, goalId, true);

    await this.targets.remove(ctx, targetId, goal);

    return { success: true };
  }
}
