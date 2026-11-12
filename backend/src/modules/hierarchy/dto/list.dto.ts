import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsHexColor, IsMongoId, IsOptional, IsString, Length } from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';

export class CreateListDto {
  @ApiProperty()
  @IsMongoId()
  spaceId: string;

  @ApiPropertyOptional({ description: 'Folder da List; ausente cria na raiz do Space.' })
  @IsOptional()
  @IsMongoId()
  folderId?: string | null;

  @ApiProperty({ example: 'uSolutionsPDV — Sprint 3' })
  @IsString()
  @Length(1, 120)
  name: string;

  @ApiPropertyOptional({ example: '#2563EB' })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  statusSetId?: string | null;
}

export class UpdateListDto extends PartialType(
  OmitType(CreateListDto, ['spaceId', 'folderId'] as const),
) {}

export class MoveListDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  spaceId?: string;

  @ApiPropertyOptional({ description: 'null move a List para a raiz do Space.' })
  @IsOptional()
  @IsMongoId()
  folderId?: string | null;
}

export class ListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  spaceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  folderId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  includeArchived?: boolean;
}
