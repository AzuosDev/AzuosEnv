import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsHexColor,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';
import { MAX_GOAL_NAME_LENGTH, MAX_GOAL_OWNERS } from '../goals-fields';

export class CreateGoalFolderDto {
  @ApiProperty({ example: 'Metas 2026' })
  @IsString()
  @Length(1, MAX_GOAL_NAME_LENGTH)
  name: string;

  @ApiPropertyOptional({ example: '#2563EB' })
  @IsOptional()
  @IsHexColor()
  color?: string;
}

export class UpdateGoalFolderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, MAX_GOAL_NAME_LENGTH)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsHexColor()
  color?: string;
}

export class CreateGoalDto {
  @ApiPropertyOptional({ description: 'Pasta de metas; ausente deixa a meta na raiz.' })
  @IsOptional()
  @IsMongoId()
  folderId?: string | null;

  @ApiProperty({ example: 'Entregar o PDV da Cênio' })
  @IsString()
  @Length(1, MAX_GOAL_NAME_LENGTH)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string | null;

  @ApiPropertyOptional({ type: [String], description: 'Membros ativos responsáveis pela meta.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_GOAL_OWNERS)
  @IsMongoId({ each: true })
  ownerIds?: string[];

  @ApiPropertyOptional({ description: 'Prazo em UTC ISO 8601.' })
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @ApiPropertyOptional({ example: '#2563EB' })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional({ default: false, description: 'Visível só para quem criou e os donos.' })
  @IsOptional()
  @IsBoolean()
  private?: boolean;
}

export class UpdateGoalDto {
  @ApiPropertyOptional({ description: 'null tira a meta da pasta.' })
  @IsOptional()
  @IsMongoId()
  folderId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, MAX_GOAL_NAME_LENGTH)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_GOAL_OWNERS)
  @IsMongoId({ each: true })
  ownerIds?: string[];

  @ApiPropertyOptional({ description: 'null remove o prazo.' })
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  private?: boolean;

  @ApiPropertyOptional({ description: 'true marca a meta como concluída.' })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

export class GoalQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Metas de uma pasta.' })
  @IsOptional()
  @IsMongoId()
  folderId?: string;

  @ApiPropertyOptional({ description: 'Só as metas em que sou dono.' })
  @IsOptional()
  @IsBoolean()
  mine?: boolean;
}
