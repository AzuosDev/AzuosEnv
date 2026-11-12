import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional, Matches } from 'class-validator';

export const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const DATE_KEY_MESSAGE = 'Use uma data no formato YYYY-MM-DD.';

export class TimesheetQueryDto {
  @ApiPropertyOptional({ description: 'Outra pessoa exige papel admin.' })
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @ApiPropertyOptional({ description: 'Qualquer dia da semana; cai na segunda-feira.' })
  @IsOptional()
  @Matches(DATE_KEY_PATTERN, { message: DATE_KEY_MESSAGE })
  weekStart?: string;
}

export class SubmitTimesheetDto {
  @ApiProperty({ description: 'Qualquer dia da semana enviada.' })
  @Matches(DATE_KEY_PATTERN, { message: DATE_KEY_MESSAGE })
  weekStart: string;
}

export class ApprovalsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(DATE_KEY_PATTERN, { message: DATE_KEY_MESSAGE })
  weekStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  userId?: string;
}

export class ReviewTimesheetDto {
  @ApiProperty()
  @IsMongoId()
  userId: string;

  @ApiProperty()
  @Matches(DATE_KEY_PATTERN, { message: DATE_KEY_MESSAGE })
  weekStart: string;
}
