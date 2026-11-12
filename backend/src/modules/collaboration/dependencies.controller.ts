import {
  BadRequestException,
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
import { SuccessDto } from '../../common/dto/api-error.dto';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { ApiWorkspaceParam } from '../../common/swagger/api-workspace-param.decorator';
import { permissionContextFrom } from '../hierarchy/permission.service';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import { DependenciesService } from './dependencies.service';
import {
  CreateDependencyDto,
  DependenciesQueryDto,
  MAX_DEPENDENCY_TASK_IDS,
} from './dto/dependency.dto';
import { TaskDependency, TaskDependencyDocument } from './schemas/task-dependency.schema';

@ApiTags('dependencies')
@ApiBearerAuth()
@ApiWorkspaceParam()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/tasks/:idOrCustomId/dependencies')
export class TaskDependenciesController {
  constructor(private readonly dependencies: DependenciesService) {}

  @Post()
  @ApiCreatedResponse({
    description: 'Dependência criada; ciclo responde 400.',
    type: TaskDependency,
  })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Param('idOrCustomId') idOrCustomId: string,
    @Body() dto: CreateDependencyDto,
  ): Promise<TaskDependencyDocument> {
    return this.dependencies.create(permissionContextFrom(membership), idOrCustomId, dto);
  }

  @Get()
  @ApiOkResponse({ description: 'Dependências nos dois sentidos.', type: [TaskDependency] })
  list(
    @CurrentMembership() membership: RequestMembership,
    @Param('idOrCustomId') idOrCustomId: string,
  ): Promise<TaskDependencyDocument[]> {
    return this.dependencies.list(permissionContextFrom(membership), idOrCustomId);
  }
}

@ApiTags('dependencies')
@ApiBearerAuth()
@ApiWorkspaceParam()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/dependencies')
export class DependenciesController {
  constructor(private readonly dependencies: DependenciesService) {}

  @Get()
  @ApiOkResponse({
    description: 'Dependências entre as tarefas pedidas; o Gantt desenha as setas com isso.',
    type: [TaskDependency],
  })
  listMany(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: DependenciesQueryDto,
  ): Promise<TaskDependencyDocument[]> {
    const ids = [...new Set(query.taskIds.split(','))];

    if (ids.length > MAX_DEPENDENCY_TASK_IDS) {
      throw new BadRequestException({
        code: 'TOO_MANY_TASKS',
        message: `Peça no máximo ${String(MAX_DEPENDENCY_TASK_IDS)} tarefas por vez.`,
      });
    }

    return this.dependencies.listMany(permissionContextFrom(membership), ids);
  }

  @Delete(':dependencyId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Dependência removida.', type: SuccessDto })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('dependencyId', ParseObjectIdPipe) dependencyId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.dependencies.remove(permissionContextFrom(membership), dependencyId);

    return { success: true };
  }
}
