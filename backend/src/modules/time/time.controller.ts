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
import { CurrentMembership } from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequestMembership } from '../workspaces/workspace-context';
import {
  CreateTimeEntryDto,
  StartTimerDto,
  TimeEntryQueryDto,
  UpdateTimeEntryDto,
} from './dto/time-entry.dto';
import { TimeEntry, TimeEntryDocument } from './schemas/time-entry.schema';
import { TimeEntriesService, TimerResult } from './time-entries.service';

@ApiTags('time')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/time/timer')
export class TimerController {
  constructor(private readonly entries: TimeEntriesService) {}

  @Post('start')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Cronômetro iniciado; o anterior é parado.' })
  start(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: StartTimerDto,
  ): Promise<TimerResult> {
    return this.entries.startTimer(permissionContextFrom(membership), dto);
  }

  @Post('stop')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Cronômetro parado.', type: TimeEntry })
  stop(@CurrentMembership() membership: RequestMembership): Promise<TimeEntryDocument> {
    return this.entries.stopTimer(permissionContextFrom(membership));
  }

  @Get('current')
  @ApiOkResponse({ description: 'Cronômetro em andamento do usuário, se houver.' })
  async current(
    @CurrentMembership() membership: RequestMembership,
  ): Promise<{ entry: TimeEntryDocument | null }> {
    return { entry: await this.entries.currentTimer(permissionContextFrom(membership)) };
  }
}

@ApiTags('time')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/time/entries')
export class TimeEntriesController {
  constructor(private readonly entries: TimeEntriesService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Lançamento manual criado.', type: TimeEntry })
  create(
    @CurrentMembership() membership: RequestMembership,
    @Body() dto: CreateTimeEntryDto,
  ): Promise<TimeEntryDocument> {
    return this.entries.create(permissionContextFrom(membership), dto);
  }

  @Get()
  @ApiPagedResponse(TimeEntry, 'Lançamentos do usuário, mais recentes primeiro.')
  list(
    @CurrentMembership() membership: RequestMembership,
    @Query() query: TimeEntryQueryDto,
  ): Promise<CursorPage<TimeEntryDocument>> {
    return this.entries.list(permissionContextFrom(membership), query);
  }

  @Patch(':entryId')
  @ApiOkResponse({ description: 'Lançamento atualizado.', type: TimeEntry })
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('entryId', ParseObjectIdPipe) entryId: Types.ObjectId,
    @Body() dto: UpdateTimeEntryDto,
  ): Promise<TimeEntryDocument> {
    return this.entries.update(permissionContextFrom(membership), entryId, dto);
  }

  @Delete(':entryId')
  @ApiOkResponse({ description: 'Lançamento removido.' })
  async remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('entryId', ParseObjectIdPipe) entryId: Types.ObjectId,
  ): Promise<{ success: true }> {
    await this.entries.remove(permissionContextFrom(membership), entryId);

    return { success: true };
  }
}
