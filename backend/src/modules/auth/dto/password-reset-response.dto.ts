import { ApiProperty } from '@nestjs/swagger';

/** Resposta neutra do pedido de redefinição: nunca revela se a conta existe. */
export class PasswordResetRequestedDto {
  @ApiProperty({
    example: 'Se este e-mail tiver uma conta no Azuos Env, enviamos o link para redefinir a senha.',
  })
  message: string;
}

export class PasswordResetTokenDto {
  @ApiProperty({ example: true })
  valid: boolean;
}
