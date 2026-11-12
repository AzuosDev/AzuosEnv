import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Sessão ativa do usuário, uma por dispositivo que ainda tem refresh token. */
export class SessionDto {
  @ApiProperty({ description: 'Id da sessão; usado para encerrá-la.' })
  id: string;

  @ApiPropertyOptional({ description: 'User agent de quem abriu a sessão.' })
  userAgent?: string;

  @ApiPropertyOptional({ description: 'IP de origem registrado no login.' })
  ip?: string;

  @ApiProperty({ description: 'true na sessão que está fazendo a chamada.' })
  current: boolean;

  @ApiPropertyOptional({ format: 'date-time' })
  createdAt?: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt: string;
}
