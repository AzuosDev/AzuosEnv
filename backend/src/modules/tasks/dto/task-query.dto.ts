import { BadRequestException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import {
  Allow,
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
import { Transform, Type, plainToInstance } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';
import { ToStringArray } from '../../../common/utils/query-array';
import { FIELD_FILTER_OPS, FieldFilterOp } from '../../fields/custom-field-types';
import { STATUS_GROUPS, StatusGroup } from '../../hierarchy/status-templates';
import { MAX_BULK_IDS, TASK_PRIORITIES, TaskPriority } from '../task-fields';

export const TASK_LOCATIONS = ['space', 'folder', 'list', 'everything'] as const;
export type TaskLocation = (typeof TASK_LOCATIONS)[number];

export const TASK_GROUP_BY = ['status', 'assignee', 'priority', 'dueDate', 'none'] as const;
export type TaskGroupBy = (typeof TASK_GROUP_BY)[number];

export const TASK_SORT_BY = [
  'position',
  'dueAt',
  'priority',
  'createdAt',
  'name',
  'field',
] as const;
export type TaskSortBy = (typeof TASK_SORT_BY)[number];

export const MAX_FIELD_FILTERS = 20;

/** Filter over the value of a custom field. */
export class FieldFilterDto {
  @ApiProperty()
  @IsMongoId()
  fieldId: string;

  @ApiProperty({ enum: FIELD_FILTER_OPS })
  @IsEnum(FIELD_FILTER_OPS)
  op: FieldFilterOp;

  @ApiPropertyOptional({ description: 'Valor comparado; dispensável em isEmpty.' })
  @Allow()
  value?: unknown;
}

/** Accepts the JSON array of the query string and the array of a view config. */
function toFieldFilters(value: unknown): FieldFilterDto[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const raw: unknown = typeof value === 'string' ? parseJson(value) : value;

  if (!Array.isArray(raw)) {
    throw new BadRequestException({
      code: 'INVALID_FIELD_FILTER',
      message: 'Filtro de campo inválido.',
    });
  }

  return raw.map((item) => plainToInstance(FieldFilterDto, item));
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new BadRequestException({
      code: 'INVALID_FIELD_FILTER',
      message: 'Filtro de campo inválido.',
    });
  }
}

/** Filters shared by the query endpoint and by the config of a saved view. */
export class TaskFiltersDto {
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

  @ApiPropertyOptional({ description: 'Padrão false: só as tarefas de primeiro nível.' })
  @IsOptional()
  @IsBoolean()
  includeSubtasks?: boolean;

  @ApiPropertyOptional({ description: 'Padrão false: esconde concluídas e fechadas.' })
  @IsOptional()
  @IsBoolean()
  includeClosed?: boolean;

  @ApiPropertyOptional({ description: 'Busca por nome ou customId.' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  q?: string;

  @ApiPropertyOptional({
    type: [FieldFilterDto],
    maxItems: MAX_FIELD_FILTERS,
    description: 'JSON na query: [{"fieldId":"...","op":"eq","value":"..."}].',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toFieldFilters(value))
  @Type(() => FieldFilterDto)
  @IsArray()
  @ArrayMaxSize(MAX_FIELD_FILTERS)
  @ValidateNested({ each: true })
  fieldFilters?: FieldFilterDto[];
}

export class TaskQueryDto extends IntersectionType(TaskFiltersDto, PaginationQueryDto) {
  @ApiPropertyOptional({ enum: TASK_LOCATIONS, default: 'everything' })
  @IsOptional()
  @IsEnum(TASK_LOCATIONS)
  location?: TaskLocation;

  @ApiPropertyOptional({ description: 'Id do Space, Folder ou List de `location`.' })
  @IsOptional()
  @IsMongoId()
  locationId?: string;

  @ApiPropertyOptional({ enum: TASK_GROUP_BY, default: 'none' })
  @IsOptional()
  @IsEnum(TASK_GROUP_BY)
  groupBy?: TaskGroupBy;

  @ApiPropertyOptional({ enum: TASK_SORT_BY, default: 'position' })
  @IsOptional()
  @IsEnum(TASK_SORT_BY)
  sortBy?: TaskSortBy;

  @ApiPropertyOptional({ description: 'Campo personalizado usado quando sortBy = field.' })
  @IsOptional()
  @IsMongoId()
  sortFieldId?: string;
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
