import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';
import { TEMPLATE_TYPES, TemplateType } from '../automation-fields';

/** Where an applied template lands; a Space template takes no target. */
export const TEMPLATE_TARGET_TYPES = ['space', 'folder', 'list', 'task'] as const;
export type TemplateTargetType = (typeof TEMPLATE_TARGET_TYPES)[number];

export class CreateTemplateDto {
  @ApiProperty({ enum: TEMPLATE_TYPES })
  @IsEnum(TEMPLATE_TYPES)
  type: TemplateType;

  @ApiProperty({ description: 'Nome do template.' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 160)
  name: string;

  @ApiProperty({ description: 'Recurso que vira o snapshot (do mesmo tipo do template).' })
  @IsMongoId()
  sourceId: string;
}

export class ApplyTemplateDto {
  @ApiPropertyOptional({
    enum: TEMPLATE_TARGET_TYPES,
    description: 'Local de destino; ausente aplica um Space na raiz do workspace.',
  })
  @IsOptional()
  @IsEnum(TEMPLATE_TARGET_TYPES)
  targetType?: TemplateTargetType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  targetId?: string;

  @ApiPropertyOptional({ description: 'Substitui o nome gravado no template.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 500)
  name?: string;

  @ApiPropertyOptional({ description: 'Ancora das datas relativas (UTC ISO 8601); padrao agora.' })
  @IsOptional()
  @IsDateString()
  startAt?: string;
}

export class TemplateQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TEMPLATE_TYPES })
  @IsOptional()
  @IsEnum(TEMPLATE_TYPES)
  type?: TemplateType;
}
