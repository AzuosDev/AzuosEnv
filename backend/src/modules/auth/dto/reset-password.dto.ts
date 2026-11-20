import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches, MaxLength } from 'class-validator';
import { PASSWORD_PATTERN, PASSWORD_RULE_MESSAGE } from './password.rule';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token recebido por e-mail.' })
  @IsString()
  @Length(10, 200)
  token: string;

  @ApiProperty({ example: 'Azuos2026' })
  @IsString()
  @MaxLength(128)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE })
  password: string;
}
