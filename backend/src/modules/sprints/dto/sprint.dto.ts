import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';
import {
  MAX_SPRINT_DURATION_DAYS,
  MAX_SPRINT_NAME_LENGTH,
  MIN_SPRINT_DURATION_DAYS,
} from '../sprint-fields';

export class CreateSprintFolderDto {
  @ApiProperty()
  @IsMongoId()
  spaceId: string;

  @ApiProperty({ example: 'Sprints uSolutionsPDV' })
  @IsString()
  @Length(1, MAX_SPRINT_NAME_LENGTH)
  name: string;

  @ApiPropertyOptional({ description: 'Duração de cada sprint em dias; padrão 14.' })
  @IsOptional()
  @IsInt()
  @Min(MIN_SPRINT_DURATION_DAYS)
  @Max(MAX_SPRINT_DURATION_DAYS)
  durationDays?: number;

  @ApiProperty({ description: 'Primeiro dia da primeira sprint (UTC ISO 8601).' })
  @IsDateString()
  startDate: string;
}

export class UpdateSprintFolderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, MAX_SPRINT_NAME_LENGTH)
  name?: string;

  @ApiPropertyOptional({ description: 'Vale para as próximas sprints criadas.' })
  @IsOptional()
  @IsInt()
  @Min(MIN_SPRINT_DURATION_DAYS)
  @Max(MAX_SPRINT_DURATION_DAYS)
  durationDays?: number;
}

export class CreateSprintDto {
  @ApiPropertyOptional({ description: 'Nome da sprint; ausente usa Sprint <n>.' })
  @IsOptional()
  @IsString()
  @Length(1, MAX_SPRINT_NAME_LENGTH)
  name?: string;

  @ApiPropertyOptional({ description: 'Início; ausente segue o fim da última sprint.' })
  @IsOptional()
  @IsDateString()
  startDate?: string;
}

export class SprintFolderQueryDto extends PaginationQueryDto {}
