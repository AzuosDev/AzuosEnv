import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';
import { TASK_LOCATIONS, TaskLocation } from '../../tasks/dto/task-query.dto';

export class ActivityQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TASK_LOCATIONS, default: 'everything' })
  @IsOptional()
  @IsEnum(TASK_LOCATIONS)
  location?: TaskLocation;

  @ApiPropertyOptional({ description: 'Id do Space, Folder ou List de `location`.' })
  @IsOptional()
  @IsMongoId()
  locationId?: string;
}
