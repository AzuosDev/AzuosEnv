import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMongoId } from 'class-validator';
import { FAVORITE_ENTITY_TYPES, FavoriteEntityType } from '../favorite-fields';

export class CreateFavoriteDto {
  @ApiProperty({ enum: FAVORITE_ENTITY_TYPES })
  @IsEnum(FAVORITE_ENTITY_TYPES)
  entityType: FavoriteEntityType;

  @ApiProperty()
  @IsMongoId()
  entityId: string;
}
