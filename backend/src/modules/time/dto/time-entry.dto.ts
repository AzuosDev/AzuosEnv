import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';

export const MAX_NOTE_LENGTH = 500;

/** Minutes of a single entry; a day of work is far below the cap. */
export const MAX_DURATION_MINUTES = 24 * 60;

export class StartTimerDto {
  @ApiProperty({ description: 'Tarefa cronometrada.' })
  @IsMongoId()
  taskId: string;
}

export class CreateTimeEntryDto {
  @ApiProperty()
  @IsMongoId()
  taskId: string;

  @ApiProperty({ description: 'Início em UTC ISO 8601.' })
  @IsDateString()
  start: string;

  @ApiPropertyOptional({ description: 'Fim; dispensável quando vem durationMinutes.' })
  @IsOptional()
  @IsDateString()
  end?: string;

  @ApiPropertyOptional({ maximum: MAX_DURATION_MINUTES })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  billable?: boolean;

  @ApiPropertyOptional({ maxLength: MAX_NOTE_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOTE_LENGTH)
  note?: string;
}

export class UpdateTimeEntryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  start?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  end?: string;

  @ApiPropertyOptional({ maximum: MAX_DURATION_MINUTES })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  billable?: boolean;

  @ApiPropertyOptional({ maxLength: MAX_NOTE_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOTE_LENGTH)
  note?: string;
}

export class TimeEntryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Outra pessoa exige papel admin.' })
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  taskId?: string;

  @ApiPropertyOptional({ description: 'Início do recorte em UTC ISO 8601.' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Fim do recorte em UTC ISO 8601.' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
