import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { MAX_MESSAGE_ATTACHMENTS, MAX_MESSAGE_TEXT_LENGTH } from '../chat-fields';

export class CreateMessageDto {
  @ApiProperty({ example: 'Subi o build do PDV' })
  @IsString()
  @Length(1, MAX_MESSAGE_TEXT_LENGTH)
  bodyText: string;

  @ApiPropertyOptional({ description: 'JSON do editor; as menções saem daqui.' })
  @IsOptional()
  @IsObject()
  body?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Mensagem raiz da thread.' })
  @IsOptional()
  @IsMongoId()
  parentMessageId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_MESSAGE_ATTACHMENTS)
  @IsMongoId({ each: true })
  attachmentIds?: string[];
}

export class UpdateMessageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, MAX_MESSAGE_TEXT_LENGTH)
  bodyText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  body?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_MESSAGE_ATTACHMENTS)
  @IsMongoId({ each: true })
  attachmentIds?: string[];
}

export class MessageReactionDto {
  @ApiProperty({ example: '👍' })
  @IsString()
  @Length(1, 40)
  emoji: string;
}

export class MessageToTaskDto {
  @ApiProperty({ description: 'List onde a tarefa será criada.' })
  @IsMongoId()
  listId: string;
}
