import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsHexColor, IsMongoId, IsOptional, IsString, Length } from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';

export class CreateTagDto {
  @ApiProperty()
  @IsMongoId()
  spaceId: string;

  @ApiProperty({ example: 'backend' })
  @IsString()
  @Length(1, 40)
  name: string;

  @ApiPropertyOptional({ example: '#2563EB' })
  @IsOptional()
  @IsHexColor()
  color?: string;
}

export class UpdateTagDto extends PartialType(OmitType(CreateTagDto, ['spaceId'] as const)) {}

export class TagQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  spaceId?: string;
}
