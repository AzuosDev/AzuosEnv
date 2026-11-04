import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';
import { MAX_DOC_TITLE_LENGTH, MAX_PAGE_TEXT_LENGTH } from '../docs-fields';

const MAX_MENTIONED_TASKS = 200;

export class CreatePageDto {
  @ApiPropertyOptional({ description: 'Página pai; ausente cria na raiz do Doc.' })
  @IsOptional()
  @IsMongoId()
  parentPageId?: string;

  @ApiProperty({ example: 'Passo a passo' })
  @IsString()
  @Length(1, MAX_DOC_TITLE_LENGTH)
  title: string;

  @ApiPropertyOptional({ description: 'JSON do editor (Tiptap/ProseMirror).' })
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Texto puro do conteúdo, usado na busca.' })
  @IsOptional()
  @IsString()
  @Length(0, MAX_PAGE_TEXT_LENGTH)
  contentText?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_MENTIONED_TASKS)
  @IsMongoId({ each: true })
  mentionedTaskIds?: string[];

  @ApiPropertyOptional({ description: 'Irmã que fica antes da página.' })
  @IsOptional()
  @IsMongoId()
  previousId?: string;

  @ApiPropertyOptional({ description: 'Irmã que fica depois da página.' })
  @IsOptional()
  @IsMongoId()
  nextId?: string;
}

export class UpdatePageDto {
  @ApiProperty({ description: 'Versão que o cliente carregou; divergência responde 409.' })
  @IsInt()
  @Min(1)
  version: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, MAX_DOC_TITLE_LENGTH)
  title?: string;

  @ApiPropertyOptional({ description: 'JSON do editor; null limpa o conteúdo.' })
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, MAX_PAGE_TEXT_LENGTH)
  contentText?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_MENTIONED_TASKS)
  @IsMongoId({ each: true })
  mentionedTaskIds?: string[];
}

export class MovePageDto {
  @ApiPropertyOptional({ description: 'Nova página pai; null leva para a raiz do Doc.' })
  @IsOptional()
  @IsMongoId()
  parentPageId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  previousId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  nextId?: string;
}

export class PageVersionQueryDto extends PaginationQueryDto {}

export class CreatePageCommentDto {
  @ApiProperty({ description: 'Texto puro do comentário.' })
  @IsString()
  @Length(1, 10_000)
  bodyText: string;

  @ApiPropertyOptional({ description: 'JSON do editor.' })
  @IsOptional()
  @IsObject()
  body?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Trecho da página ao qual o comentário está ancorado.' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  anchor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  parentCommentId?: string;
}
