import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { safeTimeZone } from '../../common/utils/timezone';
import { permissionContextFrom } from '../hierarchy/permission.service';
import { Roles } from '../workspaces/decorators/roles.decorator';
import {
  CurrentMembership,
  CurrentWorkspace,
} from '../workspaces/decorators/workspace-context.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { WorkspaceDocument } from '../workspaces/schemas/workspace.schema';
import { RequestMembership } from '../workspaces/workspace-context';
import {
  ApprovalsQueryDto,
  ReviewTimesheetDto,
  SubmitTimesheetDto,
  TimesheetQueryDto,
} from './dto/timesheet.dto';
import { ApprovalStatus } from './time-fields';
import {
  ReviewResult,
  Timesheet,
  TimesheetApproval,
  TimesheetsService,
} from './timesheets.service';

@ApiTags('timesheets')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:wsId/timesheets')
export class TimesheetsController {
  constructor(private readonly timesheets: TimesheetsService) {}

  @Get()
  @ApiOkResponse({ description: 'Grade tarefa × dia da semana, com cliente e totais.' })
  grid(
    @CurrentMembership() membership: RequestMembership,
    @CurrentWorkspace() workspace: WorkspaceDocument,
    @Query() query: TimesheetQueryDto,
  ): Promise<Timesheet> {
    return this.timesheets.grid(permissionContextFrom(membership), timezoneOf(workspace), query);
  }

  @Get('export')
  @ApiOkResponse({ description: 'Timesheet da semana em CSV.' })
  async export(
    @CurrentMembership() membership: RequestMembership,
    @CurrentWorkspace() workspace: WorkspaceDocument,
    @Query() query: TimesheetQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.timesheets.exportCsv(
      permissionContextFrom(membership),
      timezoneOf(workspace),
      query,
    );

    response
      .status(HttpStatus.OK)
      .setHeader('Content-Type', result.contentType)
      .setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
      .setHeader('Content-Length', result.body.length)
      .send(result.body);
  }

  @Post('submit')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Semana enviada para aprovação.' })
  submit(
    @CurrentMembership() membership: RequestMembership,
    @CurrentWorkspace() workspace: WorkspaceDocument,
    @Body() dto: SubmitTimesheetDto,
  ): Promise<{ weekStart: string; approvalStatus: ApprovalStatus; updated: number }> {
    return this.timesheets.submit(
      permissionContextFrom(membership),
      timezoneOf(workspace),
      dto.weekStart,
    );
  }

  @Get('approvals')
  @Roles('admin')
  @ApiOkResponse({ description: 'Semanas aguardando aprovação.' })
  approvals(
    @CurrentMembership() membership: RequestMembership,
    @CurrentWorkspace() workspace: WorkspaceDocument,
    @Query() query: ApprovalsQueryDto,
  ): Promise<{ items: TimesheetApproval[] }> {
    return this.timesheets.approvals(
      permissionContextFrom(membership),
      timezoneOf(workspace),
      query,
    );
  }

  @Post('approve')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Semana aprovada.' })
  approve(
    @CurrentMembership() membership: RequestMembership,
    @CurrentWorkspace() workspace: WorkspaceDocument,
    @Body() dto: ReviewTimesheetDto,
  ): Promise<ReviewResult> {
    return this.timesheets.review(
      permissionContextFrom(membership),
      timezoneOf(workspace),
      dto,
      'approved',
    );
  }

  @Post('reject')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Semana rejeitada.' })
  reject(
    @CurrentMembership() membership: RequestMembership,
    @CurrentWorkspace() workspace: WorkspaceDocument,
    @Body() dto: ReviewTimesheetDto,
  ): Promise<ReviewResult> {
    return this.timesheets.review(
      permissionContextFrom(membership),
      timezoneOf(workspace),
      dto,
      'rejected',
    );
  }
}

/** The grid is read in the zone of the workspace, the same for everyone. */
export function timezoneOf(workspace: WorkspaceDocument): string {
  return safeTimeZone(workspace.timezone);
}
