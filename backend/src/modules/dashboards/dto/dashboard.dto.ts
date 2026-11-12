import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';
import { TASK_LOCATIONS, TaskLocation } from '../../tasks/dto/task-query.dto';
import { DATE_KEY_PATTERN } from '../../time/dto/timesheet.dto';
import { WORKLOAD_METRICS, WorkloadMetric } from '../../time/time-fields';
import {
  CALCULATOR_OPS,
  CALCULATOR_TASK_FIELDS,
  CARD_TYPES,
  CalculatorOp,
  CalculatorTaskField,
  CardType,
  MAX_CARDS,
  MAX_CARD_LIMIT,
} from '../dashboard-cards';

const DATE_KEY_MESSAGE = 'Use uma data no formato YYYY-MM-DD.';

/** Everything a card can be pointed at; each type reads what it needs. */
export class CardConfigDto {
  @ApiPropertyOptional({ enum: TASK_LOCATIONS })
  @IsOptional()
  @IsEnum(TASK_LOCATIONS)
  location?: TaskLocation;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  locationId?: string;

  @ApiPropertyOptional({
    description: 'Sprint do burndown/burnup: recorta na List da sprint e no ciclo dela.',
  })
  @IsOptional()
  @IsMongoId()
  sprintId?: string;

  @ApiPropertyOptional({ description: 'Primeiro dia do recorte (YYYY-MM-DD).' })
  @IsOptional()
  @Matches(DATE_KEY_PATTERN, { message: DATE_KEY_MESSAGE })
  from?: string;

  @ApiPropertyOptional({ description: 'Último dia do recorte (YYYY-MM-DD).' })
  @IsOptional()
  @Matches(DATE_KEY_PATTERN, { message: DATE_KEY_MESSAGE })
  to?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  statusIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  assigneeIds?: string[];

  @ApiPropertyOptional({ description: 'Inclui tarefas em done/closed.' })
  @IsOptional()
  @IsBoolean()
  includeClosed?: boolean;

  @ApiPropertyOptional({ enum: WORKLOAD_METRICS })
  @IsOptional()
  @IsEnum(WORKLOAD_METRICS)
  metric?: WorkloadMetric;

  @ApiPropertyOptional({ description: 'Campo personalizado numérico da calculadora.' })
  @IsOptional()
  @IsMongoId()
  fieldId?: string;

  @ApiPropertyOptional({ enum: CALCULATOR_TASK_FIELDS })
  @IsOptional()
  @IsEnum(CALCULATOR_TASK_FIELDS)
  taskField?: CalculatorTaskField;

  @ApiPropertyOptional({ enum: CALCULATOR_OPS, description: 'Ausente soma (sum).' })
  @IsOptional()
  @IsEnum(CALCULATOR_OPS)
  op?: CalculatorOp;

  @ApiPropertyOptional({ maximum: MAX_CARD_LIMIT })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_CARD_LIMIT)
  limit?: number;
}

export class CardDto {
  @ApiPropertyOptional({ description: 'Gerado quando ausente.' })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  id?: string;

  @ApiProperty({ enum: CARD_TYPES })
  @IsEnum(CARD_TYPES)
  type: CardType;

  @ApiPropertyOptional({ type: CardConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CardConfigDto)
  config?: CardConfigDto;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  x?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  y?: number;

  @ApiPropertyOptional({ default: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  w?: number;

  @ApiPropertyOptional({ default: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  h?: number;
}

export class CreateDashboardDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  name: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  private?: boolean;

  @ApiPropertyOptional({ type: [CardDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CARDS)
  @ValidateNested({ each: true })
  @Type(() => CardDto)
  cards?: CardDto[];
}

export class UpdateDashboardDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  private?: boolean;

  @ApiPropertyOptional({ type: [CardDto], description: 'Substitui a grade inteira.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CARDS)
  @ValidateNested({ each: true })
  @Type(() => CardDto)
  cards?: CardDto[];
}

export class CardDataDto {
  @ApiPropertyOptional({ type: CardConfigDto, description: 'Sobrepõe o config salvo do card.' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CardConfigDto)
  config?: CardConfigDto;
}

export class DashboardQueryDto extends PaginationQueryDto {}
