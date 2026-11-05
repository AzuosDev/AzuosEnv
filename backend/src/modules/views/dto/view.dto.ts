import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';
import {
  TASK_GROUP_BY,
  TASK_SORT_BY,
  TaskFiltersDto,
  TaskGroupBy,
  TaskSortBy,
} from '../../tasks/dto/task-query.dto';
import {
  EXPORT_FORMATS,
  ExportFormat,
  MAX_VIEW_COLUMNS,
  VIEW_LOCATION_TYPES,
  VIEW_TYPES,
  ViewLocationType,
  ViewType,
} from '../view-types';

export class ViewColumnDto {
  @ApiProperty({ description: 'Coluna da tarefa ou `field:<id>` de campo personalizado.' })
  @IsString()
  @Length(1, 60)
  key: string;

  @ApiPropertyOptional({ description: 'Largura em pixels.' })
  @IsOptional()
  @IsInt()
  @Min(40)
  @Max(1000)
  width?: number;

  @ApiPropertyOptional({ description: 'Padrão true.' })
  @IsOptional()
  @IsBoolean()
  visible?: boolean;
}

export class ViewConfigDto {
  @ApiPropertyOptional({ type: TaskFiltersDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TaskFiltersDto)
  filters?: TaskFiltersDto;

  @ApiPropertyOptional({ enum: TASK_GROUP_BY })
  @IsOptional()
  @IsEnum(TASK_GROUP_BY)
  groupBy?: TaskGroupBy;

  @ApiPropertyOptional({ enum: TASK_GROUP_BY })
  @IsOptional()
  @IsEnum(TASK_GROUP_BY)
  subGroupBy?: TaskGroupBy;

  @ApiPropertyOptional({ enum: TASK_SORT_BY })
  @IsOptional()
  @IsEnum(TASK_SORT_BY)
  sortBy?: TaskSortBy;

  @ApiPropertyOptional({ description: 'Campo personalizado usado quando sortBy = field.' })
  @IsOptional()
  @IsMongoId()
  sortFieldId?: string;

  @ApiPropertyOptional({ type: [ViewColumnDto], maxItems: MAX_VIEW_COLUMNS })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_VIEW_COLUMNS)
  @ValidateNested({ each: true })
  @Type(() => ViewColumnDto)
  columns?: ViewColumnDto[];

  @ApiPropertyOptional({ description: 'Padrão false.' })
  @IsOptional()
  @IsBoolean()
  showSubtasks?: boolean;

  @ApiPropertyOptional({ description: 'Padrão false.' })
  @IsOptional()
  @IsBoolean()
  showClosed?: boolean;

  @ApiPropertyOptional({ description: 'Opções específicas do tipo de view.' })
  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;
}

export class CreateViewDto {
  @ApiProperty({ enum: VIEW_LOCATION_TYPES })
  @IsEnum(VIEW_LOCATION_TYPES)
  locationType: ViewLocationType;

  @ApiPropertyOptional({ description: 'Obrigatório fora de `everything`.' })
  @IsOptional()
  @IsMongoId()
  locationId?: string;

  @ApiProperty({ enum: VIEW_TYPES })
  @IsEnum(VIEW_TYPES)
  type: ViewType;

  @ApiProperty({ example: 'Sprint atual' })
  @IsString()
  @Length(1, 120)
  name: string;

  @ApiPropertyOptional({ type: ViewConfigDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ViewConfigDto)
  config?: ViewConfigDto;

  @ApiPropertyOptional({ description: 'Visível apenas para o dono; padrão false.' })
  @IsOptional()
  @IsBoolean()
  private?: boolean;

  @ApiPropertyOptional({ description: 'Só o dono edita; padrão false.' })
  @IsOptional()
  @IsBoolean()
  protected?: boolean;

  @ApiPropertyOptional({ description: 'Padrão false.' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: 'Padrão false.' })
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}

/** A view never changes de localização; duplique para levar para outro lugar. */
export class UpdateViewDto extends PartialType(
  OmitType(CreateViewDto, ['locationType', 'locationId', 'type'] as const),
) {}

export class ViewQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: VIEW_LOCATION_TYPES })
  @IsOptional()
  @IsEnum(VIEW_LOCATION_TYPES)
  locationType?: ViewLocationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  locationId?: string;
}

export class ExportQueryDto {
  @ApiPropertyOptional({ enum: EXPORT_FORMATS, default: 'csv' })
  @IsOptional()
  @IsEnum(EXPORT_FORMATS)
  format?: ExportFormat;
}
