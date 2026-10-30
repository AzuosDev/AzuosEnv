import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';
import { ToStringArray } from '../../../common/utils/query-array';
import { STATUS_GROUPS, StatusGroup } from '../../hierarchy/status-templates';
import { MAX_BULK_IDS, TASK_PRIORITIES, TaskPriority } from '../task-fields';

export const TASK_LOCATIONS = ['space', 'folder', 'list', 'everything'] as const;
export type TaskLocation = (typeof TASK_LOCATIONS)[number];

export const TASK_GROUP_BY = ['status', 'assignee', 'priority', 'dueDate', 'none'] as const;
export type TaskGroupBy = (typeof TASK_GROUP_BY)[number];

export const TASK_SORT_BY = ['position', 'dueAt', 'priority', 'createdAt', 'name'] as const;
export type TaskSortBy = (typeof TASK_SORT_BY)[number];

export class TaskQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TASK_LOCATIONS, default: 'everything' })
  @IsOptional()
  @IsEnum(TASK_LOCATIONS)
  location?: TaskLocation;

  @ApiPropertyOptional({ description: 'Id do Space, Folder ou List de `location`.' })
  @IsOptional()
  @IsMongoId()
  locationId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @ToStringArray()
  @IsArray()
  @IsMongoId({ each: true })
  statusIds?: string[];

  @ApiPropertyOptional({ enum: STATUS_GROUPS, isArray: true })
  @IsOptional()
  @ToStringArray()
  @IsArray()
  @IsEnum(STATUS_GROUPS, { each: true })
  statusGroups?: StatusGroup[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @ToStringArray()
  @IsArray()
  @IsMongoId({ each: true })
  assigneeIds?: string[];

  @ApiPropertyOptional({ description: 'Inclui as tarefas do usuário autenticado.' })
  @IsOptional()
  @IsBoolean()
  me?: boolean;

  @ApiPropertyOptional({ enum: TASK_PRIORITIES, isArray: true })
  @IsOptional()
  @ToStringArray()
  @IsArray()
  @IsEnum(TASK_PRIORITIES, { each: true })
  priority?: TaskPriority[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @ToStringArray()
  @IsArray()
  @IsMongoId({ each: true })
  tagIds?: string[];

  @ApiPropertyOptional({ description: 'UTC ISO 8601.' })
  @IsOptional()
  @IsDateString()
  dueFrom?: string;

  @ApiPropertyOptional({ description: 'UTC ISO 8601.' })
  @IsOptional()
  @IsDateString()
  dueTo?: string;

  @ApiPropertyOptional({ description: 'UTC ISO 8601.' })
  @IsOptional()
  @IsDateString()
  startFrom?: string;

  @ApiPropertyOptional({ description: 'UTC ISO 8601.' })
  @IsOptional()
  @IsDateString()
  startTo?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  includeSubtasks?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  includeClosed?: boolean;

  @ApiPropertyOptional({ description: 'Busca por nome ou customId.' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  q?: string;

  @ApiPropertyOptional({ enum: TASK_GROUP_BY, default: 'none' })
  @IsOptional()
  @IsEnum(TASK_GROUP_BY)
  groupBy?: TaskGroupBy;

  @ApiPropertyOptional({ enum: TASK_SORT_BY, default: 'position' })
  @IsOptional()
  @IsEnum(TASK_SORT_BY)
  sortBy?: TaskSortBy;
}

export class BulkChangesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  statusId?: string;

  @ApiPropertyOptional({ enum: TASK_PRIORITIES })
  @IsOptional()
  @IsEnum(TASK_PRIORITIES)
  priority?: TaskPriority | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  addAssigneeIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  removeAssigneeIds?: string[];

  @ApiPropertyOptional({ description: 'UTC ISO 8601; null limpa a data.' })
  @IsOptional()
  @IsDateString()
  startAt?: string | null;

  @ApiPropertyOptional({ description: 'UTC ISO 8601; null limpa a data.' })
  @IsOptional()
  @IsDateString()
  dueAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dueHasTime?: boolean;

  @ApiPropertyOptional({ description: 'List de destino.' })
  @IsOptional()
  @IsMongoId()
  listId?: string;

  @ApiPropertyOptional({ description: 'true envia as tarefas para a lixeira.' })
  @IsOptional()
  @IsBoolean()
  deleted?: boolean;
}

export class BulkTasksDto {
  @ApiPropertyOptional({ type: [String], maxItems: MAX_BULK_IDS })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BULK_IDS)
  @IsMongoId({ each: true })
  ids: string[];

  @ApiPropertyOptional({ type: BulkChangesDto })
  @IsObject()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => BulkChangesDto)
  changes: BulkChangesDto;
}
