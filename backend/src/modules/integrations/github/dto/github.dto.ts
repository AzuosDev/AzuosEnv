import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';
import { MAX_REPOSITORY_LENGTH } from '../github-fields';

const REPOSITORY_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

export class CreateGithubIntegrationDto {
  @ApiProperty({ example: 'azuosdev/usolutions-pdv' })
  @IsString()
  @Length(3, MAX_REPOSITORY_LENGTH)
  @Matches(REPOSITORY_PATTERN, { message: 'repository precisa estar no formato dono/nome.' })
  repository: string;

  @ApiPropertyOptional({ description: 'Secret do webhook; ausente, o servidor gera um.' })
  @IsOptional()
  @IsString()
  @Length(16, 200)
  secret?: string;

  @ApiPropertyOptional({ default: 'Code review' })
  @IsOptional()
  @IsString()
  @Length(1, 60)
  reviewStatusName?: string;

  @ApiPropertyOptional({ default: 'Deploy' })
  @IsOptional()
  @IsString()
  @Length(1, 60)
  deployStatusName?: string;
}

export class UpdateGithubIntegrationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 60)
  reviewStatusName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 60)
  deployStatusName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ description: 'true gera um secret novo, devolvido uma única vez.' })
  @IsOptional()
  @IsBoolean()
  rotateSecret?: boolean;
}
