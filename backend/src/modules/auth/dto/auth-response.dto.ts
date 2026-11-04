import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Usuário autenticado como ele chega ao front. */
export class AuthUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Felipe Souza' })
  name: string;

  @ApiProperty({ format: 'email', example: 'felipe@azuos.dev' })
  email: string;

  @ApiPropertyOptional({ format: 'uri' })
  avatarUrl?: string;

  @ApiProperty({ example: 'America/Fortaleza' })
  timezone: string;

  @ApiProperty({ example: 'pt-BR' })
  locale: string;

  @ApiProperty({ enum: ['dark', 'light', 'system'], example: 'dark' })
  theme: string;

  @ApiPropertyOptional({ format: 'date-time' })
  lastLoginAt?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  createdAt?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  updatedAt?: string;
}

/** Sessão autenticada: access token no corpo, refresh token no cookie httpOnly. */
export class AuthResponseDto {
  @ApiProperty({ description: 'Access token; o front guarda apenas em memória.' })
  accessToken: string;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}

/** Cadastro: cria a conta sem abrir sessão. */
export class RegisteredUserDto {
  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}
