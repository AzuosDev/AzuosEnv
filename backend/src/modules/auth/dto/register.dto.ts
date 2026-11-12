import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
import { PASSWORD_PATTERN, PASSWORD_RULE_MESSAGE } from './password.rule';

const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @ApiProperty({ example: 'Felipe Souza' })
  @IsString()
  @Length(2, 120)
  name: string;

  @ApiProperty({ example: 'felipe@azuos.dev' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'Azuos2026' })
  @IsString()
  @MaxLength(128)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE })
  password: string;
}
