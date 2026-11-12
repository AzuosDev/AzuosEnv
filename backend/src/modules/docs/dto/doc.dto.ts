import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsMongoId, IsOptional, IsString, Length } from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';
import {
  DOC_HUB_TABS,
  DOC_LOCATION_TYPES,
  DocHubTab,
  DocLocationType,
  MAX_DOC_TITLE_LENGTH,
} from '../docs-fields';

export class CreateDocDto {
  @ApiProperty({ enum: DOC_LOCATION_TYPES })
  @IsEnum(DOC_LOCATION_TYPES)
  locationType: DocLocationType;

  @ApiPropertyOptional({ description: 'Obrigatório fora de locationType workspace.' })
  @IsOptional()
  @IsMongoId()
  locationId?: string;

  @ApiProperty({ example: 'Guia de deploy' })
  @IsString()
  @Length(1, MAX_DOC_TITLE_LENGTH)
  title: string;

  @ApiPropertyOptional({ example: 'book' })
  @IsOptional()
  @IsString()
  @Length(1, 40)
  icon?: string;

  @ApiPropertyOptional({ description: 'Visível apenas para quem criou (padrão false).' })
  @IsOptional()
  @IsBoolean()
  private?: boolean;

  @ApiPropertyOptional({ description: 'Doc de referência do local (padrão false).' })
  @IsOptional()
  @IsBoolean()
  isWiki?: boolean;
}

export class UpdateDocDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, MAX_DOC_TITLE_LENGTH)
  title?: string;

  @ApiPropertyOptional({ description: 'null remove o ícone.' })
  @IsOptional()
  @IsString()
  @Length(1, 40)
  icon?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  private?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isWiki?: boolean;
}

export class DocQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DOC_HUB_TABS, description: 'Aba do hub (padrão all).' })
  @IsOptional()
  @IsEnum(DOC_HUB_TABS)
  tab?: DocHubTab;

  @ApiPropertyOptional({ enum: DOC_LOCATION_TYPES })
  @IsOptional()
  @IsEnum(DOC_LOCATION_TYPES)
  locationType?: DocLocationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  locationId?: string;
}

export class ShareDocDto {
  @ApiProperty({ description: 'true gera o link público; false revoga o token.' })
  @IsBoolean()
  public: boolean;
}
