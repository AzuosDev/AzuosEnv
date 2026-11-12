import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_PATTERN, PASSWORD_RULE_MESSAGE } from '../../auth/dto/password.rule';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  currentPassword: string;

  @ApiProperty({ example: 'NovaSenha123' })
  @IsString()
  @MaxLength(128)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE })
  newPassword: string;
}
