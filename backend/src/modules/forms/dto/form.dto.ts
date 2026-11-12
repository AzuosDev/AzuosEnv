import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';
import {
  FORM_CONDITION_OPS,
  FORM_FIELD_TYPES,
  FormConditionOp,
  FormFieldType,
  MAP_TO_PATTERN,
  MAX_FORM_CONDITIONS,
  MAX_FORM_FIELDS,
  MAX_FORM_NOTIFY,
  MAX_FORM_OPTIONS,
  MAX_FORM_TITLE_LENGTH,
} from '../form-fields';

export class FormFieldOptionDto {
  @ApiProperty()
  @IsString()
  @Length(1, 64)
  id: string;

  @ApiProperty()
  @IsString()
  @Length(1, 200)
  label: string;
}

export class FormFieldDto {
  @ApiProperty({ description: 'Id estável do campo; as respostas vêm por ele.' })
  @IsString()
  @Length(1, 64)
  id: string;

  @ApiProperty({ example: 'Qual o problema?' })
  @IsString()
  @Length(1, 200)
  label: string;

  @ApiProperty({ enum: FORM_FIELD_TYPES })
  @IsEnum(FORM_FIELD_TYPES)
  type: FormFieldType;

  @ApiPropertyOptional({ description: 'Padrão: false.' })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ type: [FormFieldOptionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FORM_OPTIONS)
  @ValidateNested({ each: true })
  @Type(() => FormFieldOptionDto)
  options?: FormFieldOptionDto[];

  @ApiPropertyOptional({
    description: 'name, description, priority, dueAt, assignee ou customField:<id>.',
  })
  @IsOptional()
  @Matches(MAP_TO_PATTERN, { message: 'mapTo inválido.' })
  mapTo?: string | null;
}

export class FormConditionDto {
  @ApiProperty()
  @IsString()
  @Length(1, 64)
  fieldId: string;

  @ApiProperty({ enum: FORM_CONDITION_OPS })
  @IsEnum(FORM_CONDITION_OPS)
  op: FormConditionOp;

  @ApiPropertyOptional({ description: 'Valor comparado; dispensado em isEmpty e isNotEmpty.' })
  @Allow()
  value?: unknown;

  @ApiProperty({ type: [String], description: 'Campos revelados quando a condição bate.' })
  @IsArray()
  @ArrayMaxSize(MAX_FORM_FIELDS)
  @IsString({ each: true })
  showFieldIds: string[];
}

export class CreateFormDto {
  @ApiProperty({ description: 'List em que a tarefa é criada.' })
  @IsMongoId()
  listId: string;

  @ApiProperty({ example: 'Abrir chamado' })
  @IsString()
  @Length(1, MAX_FORM_TITLE_LENGTH)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string | null;

  @ApiProperty({ type: [FormFieldDto] })
  @IsArray()
  @ArrayMaxSize(MAX_FORM_FIELDS)
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  fields: FormFieldDto[];

  @ApiPropertyOptional({ type: [FormConditionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FORM_CONDITIONS)
  @ValidateNested({ each: true })
  @Type(() => FormConditionDto)
  conditions?: FormConditionDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  defaultAssigneeId?: string | null;

  @ApiPropertyOptional({ description: 'Status do conjunto da List.' })
  @IsOptional()
  @IsMongoId()
  defaultStatusId?: string | null;

  @ApiPropertyOptional({ type: [String], description: 'Membros avisados a cada envio.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FORM_NOTIFY)
  @IsMongoId({ each: true })
  notify?: string[];

  @ApiPropertyOptional({ description: 'Padrão: true.' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateFormDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, MAX_FORM_TITLE_LENGTH)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string | null;

  @ApiPropertyOptional({ type: [FormFieldDto], description: 'Substitui todos os campos.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FORM_FIELDS)
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  fields?: FormFieldDto[];

  @ApiPropertyOptional({ type: [FormConditionDto], description: 'Substitui as condições.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FORM_CONDITIONS)
  @ValidateNested({ each: true })
  @Type(() => FormConditionDto)
  conditions?: FormConditionDto[];

  @ApiPropertyOptional({ description: 'null remove o responsável padrão.' })
  @IsOptional()
  @IsMongoId()
  defaultAssigneeId?: string | null;

  @ApiPropertyOptional({ description: 'null volta para o primeiro status da List.' })
  @IsOptional()
  @IsMongoId()
  defaultStatusId?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FORM_NOTIFY)
  @IsMongoId({ each: true })
  notify?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class FormQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Formulários de uma List.' })
  @IsOptional()
  @IsMongoId()
  listId?: string;
}
