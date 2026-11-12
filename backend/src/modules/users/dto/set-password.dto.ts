import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';
import { PASSWORD_PATTERN, PASSWORD_RULE_MESSAGE } from '../../auth/dto/password.rule';

/** Primeira senha de uma conta criada só com o Google. */
export class SetPasswordDto {
  @ApiProperty({ example: 'Azuos2026' })
  @IsString()
  @MaxLength(128)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE })
  password: string;
}
