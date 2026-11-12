import { ApiProperty } from '@nestjs/swagger';
import { Comment } from '../../collaboration/schemas/comment.schema';
import { Doc } from '../schemas/doc.schema';
import { DocPage } from '../schemas/doc-page.schema';

/** Resposta de POST /docs/:docId/share: o token só aparece na criação. */
export class ShareDocResultDto {
  @ApiProperty({ type: Doc })
  doc: Doc;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Token do link público; só nesta resposta e null ao revogar.',
  })
  token: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'URL pública do Doc.' })
  url: string | null;
}

/** Árvore do Doc: as páginas em ordem manual, achatadas por parentPageId. */
export class DocPagesDto {
  @ApiProperty({ type: [DocPage] })
  items: DocPage[];
}

/** Doc compartilhado por link público, somente leitura. */
export class PublicDocDto {
  @ApiProperty({ type: Doc })
  doc: Doc;

  @ApiProperty({ type: [DocPage] })
  pages: DocPage[];
}

/** Thread de comentários da página: o comentário raiz com as respostas. */
export class PageCommentThreadDto {
  @ApiProperty({ type: Comment })
  comment: Comment;

  @ApiProperty({ type: [Comment], description: 'Respostas, da mais antiga para a mais recente.' })
  replies: Comment[];
}
