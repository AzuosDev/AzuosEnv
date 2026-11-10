import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId } from 'class-validator';
import {
  FAVORITE_ENTITY_TYPES,
  FavoriteEntityType,
  RECENT_ENTITY_TYPES,
  RecentEntityType,
} from '../favorite-fields';

export class CreateFavoriteDto {
  @ApiProperty({ enum: FAVORITE_ENTITY_TYPES })
  @IsEnum(FAVORITE_ENTITY_TYPES)
  entityType: FavoriteEntityType;

  @ApiProperty()
  @IsMongoId()
  entityId: string;
}

/** Nome e ids que a sidebar precisa para desenhar a entrada. */
export class FavoriteEntityDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ example: 'AZD-142' })
  customId?: string;

  @ApiPropertyOptional()
  spaceId?: string;

  @ApiPropertyOptional({ nullable: true })
  folderId?: string | null;

  @ApiPropertyOptional()
  listId?: string;
}

/** Favorito com o resumo da entidade; `entity` é null se ela saiu do alcance. */
export class FavoriteItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: FAVORITE_ENTITY_TYPES })
  entityType: FavoriteEntityType;

  @ApiProperty()
  entityId: string;

  @ApiProperty({ description: 'Ordem manual (fractional indexing).' })
  position: string;

  @ApiProperty({ type: FavoriteEntityDto, nullable: true })
  entity: FavoriteEntityDto | null;
}

/** Uma tarefa, List ou Doc aberta há pouco. */
export class RecentItemDto {
  @ApiProperty({ enum: RECENT_ENTITY_TYPES })
  entityType: RecentEntityType;

  @ApiProperty()
  entityId: string;

  @ApiProperty({ format: 'date-time' })
  openedAt: string;

  @ApiProperty({ type: FavoriteEntityDto })
  entity: FavoriteEntityDto;
}

/** Resultado de GET /me/recent: lista curta, da mais recente para a mais antiga. */
export class RecentItemsDto {
  @ApiProperty({ type: [RecentItemDto] })
  items: RecentItemDto[];
}
