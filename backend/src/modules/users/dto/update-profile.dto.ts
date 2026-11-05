import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUrl, Length, MaxLength, ValidateIf } from 'class-validator';
import { USER_THEMES, UserTheme } from '../schemas/user.schema';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Felipe Souza' })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @ApiPropertyOptional({
    description: 'URL da imagem; string vazia remove o avatar e volta às iniciais.',
    example: 'https://cdn.azuos.dev/avatars/felipe.png',
  })
  @IsOptional()
  @ValidateIf((dto: UpdateProfileDto) => dto.avatarUrl !== '')
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  avatarUrl?: string;

  @ApiPropertyOptional({ example: 'America/Fortaleza' })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  timezone?: string;

  @ApiPropertyOptional({ example: 'pt-BR' })
  @IsOptional()
  @IsString()
  @Length(2, 10)
  locale?: string;

  @ApiPropertyOptional({ enum: USER_THEMES })
  @IsOptional()
  @IsIn(USER_THEMES)
  theme?: UserTheme;
}
