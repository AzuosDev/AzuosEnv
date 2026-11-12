import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  Length,
} from 'class-validator';
import { MAX_EVENT_ATTENDEES, MAX_EVENT_TITLE_LENGTH, MAX_RRULE_LENGTH } from '../calendar-fields';

export class CreateCalendarEventDto {
  @ApiProperty({ example: 'Daily uSolutionsPDV' })
  @IsString()
  @Length(1, MAX_EVENT_TITLE_LENGTH)
  title: string;

  @ApiProperty({ description: 'Início em UTC ISO 8601.' })
  @IsDateString()
  start: string;

  @ApiProperty({ description: 'Fim em UTC ISO 8601; precisa ser depois do início.' })
  @IsDateString()
  end: string;

  @ApiPropertyOptional({ description: 'Padrao: false.' })
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Membros ativos do workspace.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_EVENT_ATTENDEES)
  @IsMongoId({ each: true })
  attendeeIds?: string[];

  @ApiPropertyOptional({ description: 'Tarefa do bloco de tempo.' })
  @IsOptional()
  @IsMongoId()
  taskId?: string | null;

  @ApiPropertyOptional({ example: 'https://meet.google.com/abc-defg-hij' })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  meetUrl?: string | null;

  @ApiPropertyOptional({ example: 'FREQ=WEEKLY;BYDAY=MO,WE' })
  @IsOptional()
  @IsString()
  @Length(1, MAX_RRULE_LENGTH)
  recurrence?: string | null;
}

export class UpdateCalendarEventDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, MAX_EVENT_TITLE_LENGTH)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  start?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  end?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_EVENT_ATTENDEES)
  @IsMongoId({ each: true })
  attendeeIds?: string[];

  @ApiPropertyOptional({ description: 'null desfaz o bloco de tempo.' })
  @IsOptional()
  @IsMongoId()
  taskId?: string | null;

  @ApiPropertyOptional({ description: 'null remove o link da reunião.' })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  meetUrl?: string | null;

  @ApiPropertyOptional({ description: 'null encerra a recorrência.' })
  @IsOptional()
  @IsString()
  @Length(1, MAX_RRULE_LENGTH)
  recurrence?: string | null;
}

export class CalendarRangeDto {
  @ApiProperty({ description: 'Começo do período em UTC ISO 8601.' })
  @IsDateString()
  from: string;

  @ApiProperty({ description: 'Fim do período em UTC ISO 8601.' })
  @IsDateString()
  to: string;
}

export class CreateTimeBlockDto {
  @ApiProperty()
  @IsMongoId()
  taskId: string;

  @ApiProperty({ description: 'Início do bloco em UTC ISO 8601.' })
  @IsDateString()
  start: string;

  @ApiProperty({ description: 'Fim do bloco em UTC ISO 8601.' })
  @IsDateString()
  end: string;
}
