import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SEARCH_TYPES, SearchType } from '../search-fields';

/** Campos que todo resultado da busca tem. */
export class SearchHitDto {
  @ApiProperty({ enum: SEARCH_TYPES })
  type: SearchType;

  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'Nome do item; no comentário e na mensagem é o texto.' })
  name: string;
}

export class SearchSpaceHitDto extends SearchHitDto {
  @ApiProperty({ example: '#6E56CF' })
  color: string;

  @ApiProperty({ type: String, nullable: true })
  icon: string | null;
}

export class SearchFolderHitDto extends SearchHitDto {
  @ApiProperty()
  spaceId: string;

  @ApiProperty({ type: String, nullable: true })
  parentFolderId: string | null;
}

export class SearchListHitDto extends SearchHitDto {
  @ApiProperty()
  spaceId: string;

  @ApiProperty({ type: String, nullable: true })
  folderId: string | null;
}

export class SearchTaskHitDto extends SearchHitDto {
  @ApiProperty({ example: 'AZD-142' })
  customId: string;

  @ApiProperty()
  listId: string;

  @ApiProperty({ example: 'active' })
  statusGroup: string;

  @ApiProperty({ type: String, nullable: true, example: 'high' })
  priority: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  dueAt: string | null;
}

export class SearchCommentHitDto extends SearchHitDto {
  @ApiProperty()
  bodyText: string;

  @ApiProperty()
  taskId: string;

  @ApiProperty({ example: 'AZD-142' })
  customId: string;

  @ApiProperty()
  createdBy: string;
}

export class SearchPageHitDto extends SearchHitDto {
  @ApiProperty()
  docId: string;

  @ApiProperty({ type: String, nullable: true })
  parentPageId: string | null;

  @ApiProperty({ description: 'Primeiros 200 caracteres do conteúdo.' })
  contentText: string;
}

export class SearchMessageHitDto extends SearchHitDto {
  @ApiProperty()
  bodyText: string;

  @ApiProperty()
  channelId: string;

  @ApiProperty({ type: String, nullable: true })
  parentMessageId: string | null;

  @ApiProperty()
  authorId: string;
}

export class SearchUserHitDto extends SearchHitDto {
  @ApiProperty()
  email: string;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl: string | null;
}

/** Resultados por tipo; o tipo que não foi pedido não vem. */
export class SearchResultsDto {
  @ApiPropertyOptional({ type: [SearchTaskHitDto] })
  task?: SearchTaskHitDto[];

  @ApiPropertyOptional({ type: [SearchListHitDto] })
  list?: SearchListHitDto[];

  @ApiPropertyOptional({ type: [SearchSpaceHitDto] })
  space?: SearchSpaceHitDto[];

  @ApiPropertyOptional({ type: [SearchFolderHitDto] })
  folder?: SearchFolderHitDto[];

  @ApiPropertyOptional({ type: [SearchCommentHitDto] })
  comment?: SearchCommentHitDto[];

  @ApiPropertyOptional({ type: [SearchPageHitDto] })
  page?: SearchPageHitDto[];

  @ApiPropertyOptional({ type: [SearchMessageHitDto] })
  message?: SearchMessageHitDto[];

  @ApiPropertyOptional({ type: [SearchUserHitDto] })
  user?: SearchUserHitDto[];
}

/** Resultado de GET /search. */
export class SearchResultDto {
  @ApiProperty({ description: 'Termo buscado, já sem espaços nas pontas.' })
  q: string;

  @ApiProperty({ enum: SEARCH_TYPES, isArray: true, description: 'Tipos considerados na busca.' })
  types: SearchType[];

  @ApiProperty({ type: SearchResultsDto })
  results: SearchResultsDto;
}
