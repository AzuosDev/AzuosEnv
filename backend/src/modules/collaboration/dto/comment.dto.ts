import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsObject, IsOptional, IsString, Length } from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';

export const ASSIGNED_COMMENT_STATUS = ['open', 'resolved'] as const;
export type AssignedCommentStatus = (typeof ASSIGNED_COMMENT_STATUS)[number];

export class CreateCommentDto {
  @ApiPropertyOptional({ description: 'JSON do editor; as menções saem daqui.' })
  @IsOptional()
  @IsObject()
  body?: Record<string, unknown> | null;

  @ApiProperty({ description: 'Texto puro do comentário.' })
  @IsString()
  @Length(1, 20000)
  bodyText: string;

  @ApiPropertyOptional({ description: 'Comentário raiz da thread.' })
  @IsOptional()
  @IsMongoId()
  parentCommentId?: string;

  @ApiPropertyOptional({ description: 'Membro ativo responsável pelo comentário.' })
  @IsOptional()
  @IsMongoId()
  assigneeId?: string | null;
}

export class UpdateCommentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  body?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 20000)
  bodyText?: string;
}

export class ReactionDto {
  @ApiProperty({ example: '👍', description: 'Reagir de novo com o mesmo emoji remove a reação.' })
  @IsString()
  @Length(1, 16)
  emoji: string;
}

export class AssignCommentDto {
  @ApiPropertyOptional({ description: 'null remove o responsável.' })
  @IsOptional()
  @IsMongoId()
  userId?: string | null;
}

export class AssignedCommentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ASSIGNED_COMMENT_STATUS, default: 'open' })
  @IsOptional()
  @IsEnum(ASSIGNED_COMMENT_STATUS)
  status?: AssignedCommentStatus;
}
