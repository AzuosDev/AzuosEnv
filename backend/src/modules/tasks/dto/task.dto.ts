import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';
import { TASK_PRIORITIES, TASK_TYPES, TaskPriority, TaskType } from '../task-fields';

export class CreateTaskDto {
  @ApiProperty({ example: 'Corrigir fechamento de caixa' })
  @IsString()
  @Length(1, 500)
  name: string;

  @ApiPropertyOptional({ description: 'JSON do editor.' })
  @IsOptional()
  @IsObject()
  description?: Record<string, unknown> | null;

  @ApiPropertyOptional({ description: 'Texto puro da descrição, usado na busca.' })
  @IsOptional()
  @IsString()
  @Length(0, 20000)
  descriptionText?: string;

  @ApiPropertyOptional({ description: 'Status do conjunto da List; ausente usa o primeiro.' })
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
  assigneeIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  watcherIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  tagIds?: string[];

  @ApiPropertyOptional({ description: 'UTC ISO 8601.' })
  @IsOptional()
  @IsDateString()
  startAt?: string | null;

  @ApiPropertyOptional({ description: 'UTC ISO 8601.' })
  @IsOptional()
  @IsDateString()
  dueAt?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  dueHasTime?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  estimateMinutes?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  points?: number | null;

  @ApiPropertyOptional({ enum: TASK_TYPES, default: 'task' })
  @IsOptional()
  @IsEnum(TASK_TYPES)
  type?: TaskType;

  @ApiPropertyOptional({ description: 'Tarefa pai; a subtarefa fica na List do pai.' })
  @IsOptional()
  @IsMongoId()
  parentTaskId?: string | null;
}

export class UpdateTaskDto extends PartialType(
  OmitType(CreateTaskDto, ['parentTaskId'] as const),
) {}

export class MoveTaskDto {
  @ApiPropertyOptional({ description: 'List de destino; ausente mantém a atual.' })
  @IsOptional()
  @IsMongoId()
  listId?: string;

  @ApiPropertyOptional({ description: 'Tarefa que fica antes.' })
  @IsOptional()
  @IsMongoId()
  previousId?: string;

  @ApiPropertyOptional({ description: 'Tarefa que fica depois.' })
  @IsOptional()
  @IsMongoId()
  nextId?: string;
}

export class SecondaryListDto {
  @ApiProperty()
  @IsMongoId()
  listId: string;
}

export class SubtaskQueryDto extends PaginationQueryDto {}
