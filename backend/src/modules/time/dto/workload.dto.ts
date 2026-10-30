import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsOptional, Matches } from 'class-validator';
import { TASK_LOCATIONS, TaskLocation } from '../../tasks/dto/task-query.dto';
import { WORKLOAD_METRICS, WorkloadMetric } from '../time-fields';
import { DATE_KEY_PATTERN } from './timesheet.dto';

const DATE_KEY_MESSAGE = 'Use uma data no formato YYYY-MM-DD.';

export class WorkloadQueryDto {
  @ApiProperty({ description: 'Primeiro dia do recorte (YYYY-MM-DD).' })
  @Matches(DATE_KEY_PATTERN, { message: DATE_KEY_MESSAGE })
  from: string;

  @ApiProperty({ description: 'Último dia do recorte (YYYY-MM-DD).' })
  @Matches(DATE_KEY_PATTERN, { message: DATE_KEY_MESSAGE })
  to: string;

  @ApiPropertyOptional({ enum: WORKLOAD_METRICS, default: 'tasks' })
  @IsOptional()
  @IsEnum(WORKLOAD_METRICS)
  metric?: WorkloadMetric;

  @ApiPropertyOptional({ enum: TASK_LOCATIONS, default: 'everything' })
  @IsOptional()
  @IsEnum(TASK_LOCATIONS)
  location?: TaskLocation;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  locationId?: string;
}
