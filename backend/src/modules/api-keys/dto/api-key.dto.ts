import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { API_KEY_SCOPES, ApiKeyScope, MAX_API_KEY_NAME_LENGTH } from '../api-key-fields';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'Integração do site' })
  @IsString()
  @Length(1, MAX_API_KEY_NAME_LENGTH)
  name: string;

  @ApiPropertyOptional({ enum: API_KEY_SCOPES, isArray: true, default: ['read'] })
  @IsOptional()
  @IsEnum(API_KEY_SCOPES, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(API_KEY_SCOPES.length)
  scopes?: ApiKeyScope[];

  @ApiPropertyOptional({ description: 'Data de expiração (UTC ISO 8601).' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
