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
import { Types } from 'mongoose';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { ApiWorkspaceParam } from '../../common/swagger/api-workspace-param.decorator';
import { SuccessDto } from '../../common/dto/api-error.dto';
import { permissionContextFrom } from '../hierarchy/permission.service';
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import { CalendarService } from './calendar.service';
import {
  CalendarRangeDto,
  CreateCalendarEventDto,
  CreateTimeBlockDto,
  UpdateCalendarEventDto,
} from './dto/calendar-event.dto';
import { CalendarEventsDto, PlannerResultDto } from './dto/planner-result.dto';
import { PlannerResult, PlannerService } from './planner.service';
import { CalendarEvent, CalendarEventDocument } from './schemas/calendar-event.schema';

@ApiTags('calendar')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@ApiWorkspaceParam()
@Controller('workspaces/:wsId/calendar/events')
export class CalendarEventsController {
  constructor(private readonly calendar: CalendarService) {}

  @Post()
  @ApiCreatedResponse({
    description: 'Evento criado no calendário do usuário.',
    type: CalendarEvent,
  })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateCalendarEventDto,
  ): Promise<CalendarEventDocument> {
    return this.calendar.create(permissionContextFrom(membership), dto);
  }

  @Get()
  @ApiOkResponse({
    description: 'Eventos do período, meus e os que fui convidado.',
    type: CalendarEventsDto,
  })
  async list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: CalendarRangeDto,
  ): Promise<{ items: CalendarEventDocument[] }> {
    return { items: await this.calendar.list(permissionContextFrom(membership), query) };
  }

  @Get(':eventId')
  @ApiOkResponse({ description: 'Evento.', type: CalendarEvent })
  get(
    @CurrentMembership() membership: RequestMembership,
    @Param('eventId', ParseObjectIdPipe) eventId: Types.ObjectId,
  ): Promise<CalendarEventDocument> {
    return this.calendar.get(permissionContextFrom(membership), eventId);
  }

  @Patch(':eventId')
  @ApiOkResponse({ description: 'Evento atualizado.', type: CalendarEvent })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('eventId', ParseObjectIdPipe) eventId: Types.ObjectId,
    @Body() dto: UpdateCalendarEventDto,
  ): Promise<CalendarEventDocument> {
    return this.calendar.update(permissionContextFrom(membership), eventId, dto);
  }

  @Delete(':eventId')
  @ApiOkResponse({ description: 'Evento excluído.', type: SuccessDto })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('eventId', ParseObjectIdPipe) eventId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.calendar.remove(permissionContextFrom(membership), eventId);

    return { success: true };
  }
}

@ApiTags('calendar')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@ApiWorkspaceParam()
@Controller('workspaces/:wsId/me/planner')
export class PlannerController {
  constructor(private readonly planner: PlannerService) {}

  @Get()
  @ApiOkResponse({
    description: 'Agenda, tarefas com prazo no período e tarefas sem bloco.',
    type: PlannerResultDto,
  })
  plan(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: CalendarRangeDto,
  ): Promise<PlannerResult> {
    return this.planner.planner(permissionContextFrom(membership), query);
  }

  @Post('blocks')
  @ApiCreatedResponse({
    description: 'Bloco de tempo da tarefa criado no calendário.',
    type: CalendarEvent,
  })
  block(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateTimeBlockDto,
  ): Promise<CalendarEventDocument> {
    return this.planner.block(permissionContextFrom(membership), dto);
  }
}
