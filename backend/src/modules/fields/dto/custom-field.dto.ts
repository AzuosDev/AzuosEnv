import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsHexColor,
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
import {
  CUSTOM_FIELD_SCOPES,
  CUSTOM_FIELD_TYPES,
  CustomFieldScope,
  CustomFieldType,
  MAX_FIELD_OPTIONS,
  MAX_FORMULA_LENGTH,
  MAX_PRECISION,
} from '../custom-field-types';

export class CustomFieldOptionDto {
  @ApiPropertyOptional({ description: 'Ausente, é gerado.' })
  @IsOptional()
  @IsString()
  @Length(1, 60)
  id?: string;

  @ApiProperty({ example: 'Bug' })
  @IsString()
  @Length(1, 60)
  name: string;

  @ApiPropertyOptional({ example: '#2563EB' })
  @IsOptional()
  @IsHexColor()
  color?: string;
}

export class CustomFieldConfigDto {
  @ApiPropertyOptional({ type: [CustomFieldOptionDto], maxItems: MAX_FIELD_OPTIONS })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FIELD_OPTIONS)
  @ValidateNested({ each: true })
  @Type(() => CustomFieldOptionDto)
  options?: CustomFieldOptionDto[];

  @ApiPropertyOptional({ default: 'BRL' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ description: 'Casas decimais de number e currency.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PRECISION)
  precision?: number;

  @ApiPropertyOptional({ description: 'Expressão da fórmula, ex.: {Horas} * {Valor hora}.' })
  @IsOptional()
  @IsString()
  @Length(1, MAX_FORMULA_LENGTH)
  expression?: string;

  @ApiPropertyOptional({ description: 'List alvo do relacionamento.' })
  @IsOptional()
  @IsMongoId()
  relationshipListId?: string;
}

export class CreateCustomFieldDto {
  @ApiProperty({ enum: CUSTOM_FIELD_SCOPES })
  @IsEnum(CUSTOM_FIELD_SCOPES)
  scope: CustomFieldScope;

  @ApiProperty({ description: 'Id do Space, Folder ou List.' })
  @IsMongoId()
  scopeId: string;

  @ApiProperty({ example: 'Tipo' })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({ enum: CUSTOM_FIELD_TYPES })
  @IsEnum(CUSTOM_FIELD_TYPES)
  type: CustomFieldType;

  @ApiPropertyOptional({ type: CustomFieldConfigDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CustomFieldConfigDto)
  config?: CustomFieldConfigDto;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

/** Escopo e tipo são imutáveis: trocá-los invalidaria os valores já gravados. */
export class UpdateCustomFieldDto extends PartialType(
  OmitType(CreateCustomFieldDto, ['scope', 'scopeId', 'type'] as const),
) {}

export class CustomFieldQueryDto {
  @ApiProperty({ enum: CUSTOM_FIELD_SCOPES })
  @IsEnum(CUSTOM_FIELD_SCOPES)
  scope: CustomFieldScope;

  @ApiProperty({ description: 'Id do Space, Folder ou List.' })
  @IsMongoId()
  scopeId: string;
}

/** Valor de um campo na tarefa. */
export class TaskCustomFieldDto {
  @ApiProperty()
  @IsMongoId()
  fieldId: string;

  @ApiPropertyOptional({ description: 'Valor conforme o tipo do campo; null limpa.' })
  @Allow()
  value?: unknown;
}
