import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUrl, Length, Matches, MaxLength } from 'class-validator';

export const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
export const COLOR_MESSAGE = 'A cor deve estar no formato hexadecimal (ex.: #2563EB).';
export const TASK_PREFIX_PATTERN = /^[A-Z][A-Z0-9]{1,5}$/;
export const TASK_PREFIX_MESSAGE = 'O prefixo deve ter de 2 a 6 letras ou números (ex.: AZD).';
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SLUG_MESSAGE = 'O slug aceita apenas letras minúsculas, números e hífens.';

const upperCase = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const lowerCase = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateWorkspaceDto {
  @ApiProperty({ example: 'Azuos Dev' })
  @IsString()
  @Length(2, 80)
  name: string;

  @ApiPropertyOptional({ example: 'azuos-dev', description: 'Gerado a partir do nome se ausente.' })
  @IsOptional()
  @Transform(lowerCase)
  @IsString()
  @Length(2, 48)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  slug?: string;

  @ApiPropertyOptional({ example: 'https://cdn.azuos.dev/logos/azuos.png' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  logoUrl?: string;

  @ApiPropertyOptional({ example: '#2563EB' })
  @IsOptional()
  @Matches(COLOR_PATTERN, { message: COLOR_MESSAGE })
  color?: string;

  @ApiPropertyOptional({ example: 'AZD', description: 'Gerado a partir do nome se ausente.' })
  @IsOptional()
  @Transform(upperCase)
  @Matches(TASK_PREFIX_PATTERN, { message: TASK_PREFIX_MESSAGE })
  taskPrefix?: string;

  @ApiPropertyOptional({ example: 'America/Fortaleza' })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  timezone?: string;
}
