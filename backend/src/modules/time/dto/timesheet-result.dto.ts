import { ApiProperty } from '@nestjs/swagger';
import { APPROVAL_STATUSES, ApprovalStatus } from '../time-fields';

/** One task of the week with the minutes of each day, keyed by YYYY-MM-DD. */
export class TimesheetRowDto {
  @ApiProperty()
  taskId: string;

  @ApiProperty()
  customId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  listId: string;

  @ApiProperty()
  listName: string;

  @ApiProperty({ description: 'Cliente da List; vazio quando não há.' })
  client: string;

  @ApiProperty({
    description: 'Minutos por dia, com a data YYYY-MM-DD na chave.',
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  minutes: Record<string, number>;

  @ApiProperty()
  total: number;

  @ApiProperty()
  billableMinutes: number;
}

export class TimesheetTotalsDto {
  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  byDay: Record<string, number>;

  @ApiProperty()
  total: number;

  @ApiProperty()
  billableMinutes: number;
}

/** Grid of GET /timesheets: task × day of one person in one week. */
export class TimesheetDto {
  @ApiProperty()
  userId: string;

  @ApiProperty({ example: 'America/Sao_Paulo' })
  timezone: string;

  @ApiProperty({ description: 'Segunda-feira da semana (YYYY-MM-DD).' })
  weekStart: string;

  @ApiProperty({ description: 'Domingo da semana (YYYY-MM-DD).' })
  weekEnd: string;

  @ApiProperty({ type: [String], description: 'Os sete dias da semana, de segunda a domingo.' })
  days: string[];

  @ApiProperty({ type: [TimesheetRowDto] })
  rows: TimesheetRowDto[];

  @ApiProperty({ type: TimesheetTotalsDto })
  totals: TimesheetTotalsDto;

  @ApiProperty({ enum: APPROVAL_STATUSES })
  approvalStatus: ApprovalStatus;

  @ApiProperty({ description: 'Lançamentos da semana.' })
  entries: number;
}

/** One week waiting for the admin, in GET /timesheets/approvals. */
export class TimesheetApprovalDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  weekStart: string;

  @ApiProperty()
  totalMinutes: number;

  @ApiProperty()
  billableMinutes: number;

  @ApiProperty()
  entries: number;
}

export class TimesheetApprovalsDto {
  @ApiProperty({ type: [TimesheetApprovalDto] })
  items: TimesheetApprovalDto[];
}

/** Result of POST /timesheets/submit. */
export class TimesheetSubmitResultDto {
  @ApiProperty()
  weekStart: string;

  @ApiProperty({ enum: APPROVAL_STATUSES })
  approvalStatus: ApprovalStatus;

  @ApiProperty({ description: 'Lançamentos que mudaram de status.' })
  updated: number;
}

/** Result of POST /timesheets/approve and /reject. */
export class TimesheetReviewResultDto extends TimesheetSubmitResultDto {
  @ApiProperty()
  userId: string;
}
