import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';
import { STATUS_GROUPS, StatusGroup } from '../../hierarchy/status-templates';
import { TASK_PRIORITIES, TaskPriority } from '../../tasks/task-fields';
import { CONDITION_OPS, ConditionOp } from '../automation-conditions';
import {
  ACTION_TYPES,
  AUTOMATION_LOCATION_TYPES,
  AUTOMATION_RUN_STATUSES,
  ActionType,
  AutomationLocationType,
  AutomationRunStatus,
  MAX_ACTION_IDS,
  MAX_AUTOMATION_ACTIONS,
  MAX_AUTOMATION_CONDITIONS,
  TRIGGER_TYPES,
  TriggerType,
} from '../automation-fields';

const WEBHOOK_METHODS = ['POST', 'PUT', 'PATCH'] as const;
type WebhookMethod = (typeof WEBHOOK_METHODS)[number];

/** Params of every trigger type; each type reads only what it needs. */
export class TriggerParamsDto {
  @ApiPropertyOptional({ description: 'statusChanged: status de destino.' })
  @IsOptional()
  @IsMongoId()
  toStatusId?: string;

  @ApiPropertyOptional({ enum: STATUS_GROUPS, description: 'statusChanged: grupo de destino.' })
  @IsOptional()
  @IsEnum(STATUS_GROUPS)
  toStatusGroup?: StatusGroup;

  @ApiPropertyOptional({ description: 'statusChanged: status de origem.' })
  @IsOptional()
  @IsMongoId()
  fromStatusId?: string;

  @ApiPropertyOptional({ description: 'dueDateArrived: antecedencia em minutos.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(43200)
  beforeMinutes?: number;

  @ApiPropertyOptional({ description: 'schedule: expressao cron de 5 ou 6 campos.' })
  @IsOptional()
  @IsString()
  @Length(5, 120)
  cron?: string;

  @ApiPropertyOptional({ description: 'schedule: fuso da expressao cron.' })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  timezone?: string;
}

export class TriggerDto {
  @ApiProperty({ enum: TRIGGER_TYPES })
  @IsEnum(TRIGGER_TYPES)
  type: TriggerType;

  @ApiPropertyOptional({ type: TriggerParamsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TriggerParamsDto)
  params?: TriggerParamsDto;
}

export class ConditionDto {
  @ApiProperty({ description: 'Campo da tarefa, field:<id> ou payload.<caminho>.' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  field: string;

  @ApiProperty({ enum: CONDITION_OPS })
  @IsEnum(CONDITION_OPS)
  op: ConditionOp;

  @ApiPropertyOptional({ description: 'Valor comparado; dispensavel em isEmpty.' })
  @IsOptional()
  value?: unknown;
}

/** Params of every action type. Os textos aceitam {{task.name}} e {{payload.x}}. */
export class ActionParamsDto {
  @ApiPropertyOptional({ description: 'setStatus.' })
  @IsOptional()
  @IsMongoId()
  statusId?: string;

  @ApiPropertyOptional({ enum: STATUS_GROUPS, description: 'setStatus: primeiro status do grupo.' })
  @IsOptional()
  @IsEnum(STATUS_GROUPS)
  statusGroup?: StatusGroup;

  @ApiPropertyOptional({ type: [String], description: 'assign, unassign e notify.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ACTION_IDS)
  @IsMongoId({ each: true })
  userIds?: string[];

  @ApiPropertyOptional({ enum: TASK_PRIORITIES, description: 'setPriority e createTask.' })
  @IsOptional()
  @IsEnum(TASK_PRIORITIES)
  priority?: TaskPriority;

  @ApiPropertyOptional({ description: 'addComment.' })
  @IsOptional()
  @IsString()
  @Length(1, 5000)
  bodyText?: string;

  @ApiPropertyOptional({ description: 'moveToList, createTask e applyTemplate.' })
  @IsOptional()
  @IsMongoId()
  listId?: string;

  @ApiPropertyOptional({ type: [String], description: 'addTag.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ACTION_IDS)
  @IsMongoId({ each: true })
  tagIds?: string[];

  @ApiPropertyOptional({ description: 'setCustomField.' })
  @IsOptional()
  @IsMongoId()
  fieldId?: string;

  @ApiPropertyOptional({ description: 'setCustomField: valor do campo.' })
  @IsOptional()
  value?: unknown;

  @ApiPropertyOptional({ description: 'createTask: nome da tarefa.' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  name?: string;

  @ApiPropertyOptional({ type: [String], description: 'createTask.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ACTION_IDS)
  @IsMongoId({ each: true })
  assigneeIds?: string[];

  @ApiPropertyOptional({ description: 'createTask: inicio em minutos a partir de agora.' })
  @IsOptional()
  @IsInt()
  startOffsetMinutes?: number;

  @ApiPropertyOptional({ description: 'createTask: prazo em minutos a partir de agora.' })
  @IsOptional()
  @IsInt()
  dueOffsetMinutes?: number;

  @ApiPropertyOptional({ description: 'applyTemplate.' })
  @IsOptional()
  @IsMongoId()
  templateId?: string;

  @ApiPropertyOptional({ description: 'notify: texto da notificacao.' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  message?: string;

  @ApiPropertyOptional({ description: 'callWebhook.' })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @Length(1, 2000)
  url?: string;

  @ApiPropertyOptional({ enum: WEBHOOK_METHODS, description: 'Ausente envia POST.' })
  @IsOptional()
  @IsEnum(WEBHOOK_METHODS)
  method?: WebhookMethod;

  @ApiPropertyOptional({ description: 'callWebhook: cabecalhos extras.' })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @ApiPropertyOptional({ description: 'callWebhook: corpo; ausente envia o evento.' })
  @IsOptional()
  @IsObject()
  body?: Record<string, unknown>;
}

export class ActionDto {
  @ApiProperty({ enum: ACTION_TYPES })
  @IsEnum(ACTION_TYPES)
  type: ActionType;

  @ApiPropertyOptional({ type: ActionParamsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ActionParamsDto)
  params?: ActionParamsDto;
}

export class CreateAutomationDto {
  @ApiProperty({ enum: AUTOMATION_LOCATION_TYPES })
  @IsEnum(AUTOMATION_LOCATION_TYPES)
  locationType: AutomationLocationType;

  @ApiProperty()
  @IsMongoId()
  locationId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(1, 160)
  name: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiProperty({ type: TriggerDto })
  @ValidateNested()
  @Type(() => TriggerDto)
  trigger: TriggerDto;

  @ApiPropertyOptional({ type: [ConditionDto], maxItems: MAX_AUTOMATION_CONDITIONS })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_AUTOMATION_CONDITIONS)
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  conditions?: ConditionDto[];

  @ApiProperty({ type: [ActionDto], maxItems: MAX_AUTOMATION_ACTIONS })
  @IsArray()
  @ArrayMaxSize(MAX_AUTOMATION_ACTIONS)
  @ValidateNested({ each: true })
  @Type(() => ActionDto)
  actions: ActionDto[];
}

export class UpdateAutomationDto extends PartialType(
  OmitType(CreateAutomationDto, ['locationType', 'locationId'] as const),
) {}

export class AutomationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AUTOMATION_LOCATION_TYPES })
  @IsOptional()
  @IsEnum(AUTOMATION_LOCATION_TYPES)
  locationType?: AutomationLocationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  locationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class AutomationRunQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AUTOMATION_RUN_STATUSES })
  @IsOptional()
  @IsEnum(AUTOMATION_RUN_STATUSES)
  status?: AutomationRunStatus;
}
