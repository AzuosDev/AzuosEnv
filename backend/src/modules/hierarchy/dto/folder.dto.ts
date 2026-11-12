import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsMongoId, IsOptional, IsString, Length } from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';

export class CreateFolderDto {
  @ApiProperty()
  @IsMongoId()
  spaceId: string;

  @ApiPropertyOptional({ description: 'Folder pai; cria uma subfolder.' })
  @IsOptional()
  @IsMongoId()
  parentFolderId?: string | null;

  @ApiProperty({ example: 'Cênio Construções' })
  @IsString()
  @Length(1, 80)
  name: string;

  @ApiPropertyOptional({ description: 'Folder privado: só aparece para quem for convidado.' })
  @IsOptional()
  @IsBoolean()
  private?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  statusSetId?: string | null;
}

export class UpdateFolderDto extends PartialType(
  OmitType(CreateFolderDto, ['spaceId', 'parentFolderId'] as const),
) {}

export class MoveFolderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  spaceId?: string;

  @ApiPropertyOptional({ description: 'null move a folder para a raiz do Space.' })
  @IsOptional()
  @IsMongoId()
  parentFolderId?: string | null;
}

export class FolderQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  spaceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  parentFolderId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  includeArchived?: boolean;
}
