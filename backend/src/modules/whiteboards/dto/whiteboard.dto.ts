import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';
import {
  MAX_WHITEBOARD_OPS,
  MAX_WHITEBOARD_TITLE_LENGTH,
  WHITEBOARD_LOCATION_TYPES,
  WHITEBOARD_OPS,
  WhiteboardLocationType,
  WhiteboardOpKind,
} from '../whiteboard-fields';

export class CreateWhiteboardDto {
  @ApiProperty({ enum: WHITEBOARD_LOCATION_TYPES })
  @IsEnum(WHITEBOARD_LOCATION_TYPES)
  locationType: WhiteboardLocationType;

  @ApiPropertyOptional({ description: 'Obrigatório fora de locationType workspace.' })
  @IsOptional()
  @IsMongoId()
  locationId?: string;

  @ApiProperty({ example: 'Fluxo do PDV' })
  @IsString()
  @Length(1, MAX_WHITEBOARD_TITLE_LENGTH)
  title: string;

  // The items are validated by normalizeElement, which also fills the defaults:
  // `@IsObject({ each: true })` rejects the plain objects after the transform.
  @ApiPropertyOptional({ description: 'Elementos iniciais do quadro.', type: [Object] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_WHITEBOARD_OPS)
  elements?: Record<string, unknown>[];
}

export class UpdateWhiteboardDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, MAX_WHITEBOARD_TITLE_LENGTH)
  title?: string;
}

export class WhiteboardOpDto {
  @ApiProperty({ enum: WHITEBOARD_OPS })
  @IsEnum(WHITEBOARD_OPS)
  op: WhiteboardOpKind;

  @ApiPropertyOptional({ description: 'Id do elemento; exigido em update e remove.' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  id?: string;

  @ApiPropertyOptional({ description: 'Elemento (JSON); exigido em add e update.' })
  @IsOptional()
  @IsObject()
  element?: Record<string, unknown>;
}

export class PatchWhiteboardElementsDto {
  @ApiProperty({ description: 'Versão carregada pelo cliente; divergência responde 409.' })
  @IsInt()
  @Min(1)
  version: number;

  @ApiProperty({ type: [WhiteboardOpDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_WHITEBOARD_OPS)
  @ValidateNested({ each: true })
  @Type(() => WhiteboardOpDto)
  ops: WhiteboardOpDto[];
}

export class WhiteboardQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: WHITEBOARD_LOCATION_TYPES })
  @IsOptional()
  @IsEnum(WHITEBOARD_LOCATION_TYPES)
  locationType?: WhiteboardLocationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  locationId?: string;
}

export class ElementToTaskDto {
  @ApiProperty({ description: 'List onde a tarefa é criada.' })
  @IsMongoId()
  listId: string;
}
