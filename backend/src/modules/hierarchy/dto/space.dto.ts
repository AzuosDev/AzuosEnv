import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsHexColor,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';
import { STATUS_TEMPLATES, StatusTemplate } from '../status-templates';

export class ClickAppsOverrideDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  priority?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  tags?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  timeTracking?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  estimates?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  sprints?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  customFields?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  multipleLists?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  customIds?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ai?: boolean;
}

export class CreateSpaceDto {
  @ApiProperty({ example: 'Clientes' })
  @IsString()
  @Length(1, 80)
  name: string;

  @ApiPropertyOptional({ example: '#2563EB' })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional({ example: 'users' })
  @IsOptional()
  @IsString()
  @Length(1, 40)
  icon?: string;

  @ApiPropertyOptional({ description: 'Space privado: só aparece para quem for convidado.' })
  @IsOptional()
  @IsBoolean()
  private?: boolean;

  @ApiPropertyOptional({ description: 'Conjunto de statuses existente.' })
  @IsOptional()
  @IsMongoId()
  statusSetId?: string;

  @ApiPropertyOptional({ enum: STATUS_TEMPLATES, description: 'Usado quando não há statusSetId.' })
  @IsOptional()
  @IsEnum(STATUS_TEMPLATES)
  statusTemplate?: StatusTemplate;

  @ApiPropertyOptional({ type: ClickAppsOverrideDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ClickAppsOverrideDto)
  clickApps?: ClickAppsOverrideDto;
}

export class UpdateSpaceDto extends PartialType(
  OmitType(CreateSpaceDto, ['statusTemplate'] as const),
) {}

export class SpaceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  includeArchived?: boolean;
}
