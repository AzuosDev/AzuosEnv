import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';
import { REMINDER_RECURRENCES, ReminderRecurrence } from '../notification-fields';

export const REMINDER_STATUS = ['pending', 'done'] as const;
export type ReminderStatus = (typeof REMINDER_STATUS)[number];

export class CreateReminderDto {
  @ApiProperty()
  @IsString()
  @Length(1, 500)
  text: string;

  @ApiProperty({ description: 'Data/hora em UTC ISO 8601.' })
  @IsDateString()
  remindAt: string;

  @ApiPropertyOptional({ enum: REMINDER_RECURRENCES, default: 'none' })
  @IsOptional()
  @IsEnum(REMINDER_RECURRENCES)
  recurrence?: ReminderRecurrence;

  @ApiPropertyOptional({ description: 'Tarefa relacionada; precisa ser visível para você.' })
  @IsOptional()
  @IsMongoId()
  taskId?: string | null;
}

export class UpdateReminderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 500)
  text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  remindAt?: string;

  @ApiPropertyOptional({ enum: REMINDER_RECURRENCES })
  @IsOptional()
  @IsEnum(REMINDER_RECURRENCES)
  recurrence?: ReminderRecurrence;

  @ApiPropertyOptional({ description: 'null remove a tarefa relacionada.' })
  @IsOptional()
  @IsMongoId()
  taskId?: string | null;

  @ApiPropertyOptional({ description: 'true conclui o lembrete; false reabre.' })
  @IsOptional()
  @IsBoolean()
  done?: boolean;
}

export class ReminderQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: REMINDER_STATUS, default: 'pending' })
  @IsOptional()
  @IsEnum(REMINDER_STATUS)
  status?: ReminderStatus;
}
