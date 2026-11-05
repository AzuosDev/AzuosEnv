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
import { SuccessDto } from '../../common/dto/api-error.dto';
import { ApiPagedResponse } from '../../common/swagger/api-paged-response.decorator';
import { ApiWorkspaceParam } from '../../common/swagger/api-workspace-param.decorator';
import { Types } from 'mongoose';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
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
import { BulkTasksDto, TaskQueryDto } from './dto/task-query.dto';
import { TaskDetailDto } from './dto/task-detail.dto';
import { BulkResultDto, TaskQueryResultDto } from './dto/task-result.dto';
import {
  CreateTaskDto,
  MoveTaskDto,
  SecondaryListDto,
  SubtaskQueryDto,
  UpdateTaskDto,
} from './dto/task.dto';
import { Task, TaskDocument } from './schemas/task.schema';
import { MyTasksResult, TaskQueryResult, TaskQueryService } from './task-query.service';
import { BulkResult, TaskDetail, TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@ApiWorkspaceParam()
@Controller('workspaces/:wsId/lists/:listId/tasks')
export class ListTasksController {
  constructor(private readonly tasks: TasksService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Tarefa criada.', type: Task })
  create(
    @CurrentMembership() membership: RequestMembership,
    @CurrentWorkspace() workspace: WorkspaceDocument,
    @Param('listId', ParseObjectIdPipe) listId: Types.ObjectId,
    @Body() dto: CreateTaskDto,
  ): Promise<TaskDocument> {
    return this.tasks.create(permissionContextFrom(membership), listId, workspace.taskPrefix, dto);
  }
}

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@ApiWorkspaceParam()
@Controller('workspaces/:wsId/tasks')
export class TasksController {
  constructor(
    private readonly tasks: TasksService,
    private readonly queries: TaskQueryService,
  ) {}

  @Get('query')
  @ApiOkResponse({
    description: 'Consulta das views (List, Board, Calendar, Table, Gantt).',
    type: TaskQueryResultDto,
  })
  query(
    @CurrentMembership() membership: RequestMembership,
    @CurrentUser('timezone') timezone: string,
    @Query() query: TaskQueryDto,
  ): Promise<TaskQueryResult> {
    return this.queries.query(permissionContextFrom(membership), query, timezone);
  }

  @Patch('bulk')
  @ApiOkResponse({ description: 'Alteração em lote.', type: BulkResultDto })
  bulk(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: BulkTasksDto,
  ): Promise<BulkResult> {
    return this.tasks.bulk(permissionContextFrom(membership), dto);
  }

  @Get(':idOrCustomId')
  @ApiOkResponse({
    description:
      'Tarefa por id ou customId, com resumo de subtarefas, checklists, dependências e contagens.',
    type: TaskDetailDto,
  })
  get(
    @CurrentMembership() membership: RequestMembership,
    @Param('idOrCustomId') idOrCustomId: string,
  ): Promise<TaskDetail> {
    return this.tasks.getDetail(permissionContextFrom(membership), idOrCustomId);
  }

  @Get(':idOrCustomId/subtasks')
  @ApiPagedResponse(Task, 'Subtarefas diretas.')
  subtasks(
    @CurrentMembership() membership: RequestMembership,
    @Param('idOrCustomId') idOrCustomId: string,
    @Query() query: SubtaskQueryDto,
  ): Promise<CursorPage<TaskDocument>> {
    return this.tasks.subtasks(permissionContextFrom(membership), idOrCustomId, query);
  }

  @Patch(':idOrCustomId')
  @ApiOkResponse({ description: 'Tarefa atualizada.', type: Task })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('idOrCustomId') idOrCustomId: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskDocument> {
    return this.tasks.update(permissionContextFrom(membership), idOrCustomId, dto);
  }

  @Post(':idOrCustomId/move')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Tarefa movida de List e/ou posição.', type: Task })
  move(
    @CurrentMembership() membership: RequestMembership,
    @Param('idOrCustomId') idOrCustomId: string,
    @Body() dto: MoveTaskDto,
  ): Promise<TaskDocument> {
    return this.tasks.move(permissionContextFrom(membership), idOrCustomId, dto);
  }

  @Post(':idOrCustomId/lists')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Tarefa adicionada a outra List.', type: Task })
  addList(
    @CurrentMembership() membership: RequestMembership,
    @Param('idOrCustomId') idOrCustomId: string,
    @Body() dto: SecondaryListDto,
  ): Promise<TaskDocument> {
    return this.tasks.addSecondaryList(permissionContextFrom(membership), idOrCustomId, dto.listId);
  }

  @Delete(':idOrCustomId/lists/:listId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Tarefa removida da List secundária.', type: Task })
  removeList(
    @CurrentMembership() membership: RequestMembership,
    @Param('idOrCustomId') idOrCustomId: string,
    @Param('listId', ParseObjectIdPipe) listId: Types.ObjectId,
  ): Promise<TaskDocument> {
    return this.tasks.removeSecondaryList(
      permissionContextFrom(membership),
      idOrCustomId,
      String(listId),
    );
  }

  @Post(':idOrCustomId/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Tarefa arquivada, com as subtarefas diretas.', type: Task })
  archive(
    @CurrentMembership() membership: RequestMembership,
    @Param('idOrCustomId') idOrCustomId: string,
  ): Promise<TaskDocument> {
    return this.tasks.archive(permissionContextFrom(membership), idOrCustomId);
  }

  @Post(':idOrCustomId/unarchive')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Tarefa desarquivada, com as subtarefas diretas.', type: Task })
  unarchive(
    @CurrentMembership() membership: RequestMembership,
    @Param('idOrCustomId') idOrCustomId: string,
  ): Promise<TaskDocument> {
    return this.tasks.unarchive(permissionContextFrom(membership), idOrCustomId);
  }

  @Post(':idOrCustomId/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Tarefa restaurada da lixeira.', type: Task })
  restore(
    @CurrentMembership() membership: RequestMembership,
    @Param('idOrCustomId') idOrCustomId: string,
  ): Promise<TaskDocument> {
    return this.tasks.restore(permissionContextFrom(membership), idOrCustomId);
  }

  @Delete(':idOrCustomId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Tarefa enviada para a lixeira.', type: SuccessDto })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('idOrCustomId') idOrCustomId: string,
  ): Promise<{ success: true }> {
    await this.tasks.remove(permissionContextFrom(membership), idOrCustomId);

    return { success: true };
  }
}

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@ApiWorkspaceParam()
@Controller('workspaces/:wsId/my-tasks')
export class MyTasksController {
  constructor(private readonly queries: TaskQueryService) {}

  @Get()
  @ApiOkResponse({ description: 'Minhas tarefas por seção, no fuso do usuário.' })
  myTasks(
    @CurrentMembership() membership: RequestMembership,
    @CurrentUser('timezone') timezone: string,
  ): Promise<MyTasksResult> {
    return this.queries.myTasks(permissionContextFrom(membership), timezone);
  }
}
