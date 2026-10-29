import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { PASSWORD_PATTERN, PASSWORD_RULE_MESSAGE } from '../../auth/dto/password.rule';
import { ASSIGNABLE_ROLES, AssignableRole } from '../workspace-roles';

const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateInviteDto {
  @ApiProperty({ example: 'colega@azuos.dev' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ enum: ASSIGNABLE_ROLES })
  @IsIn(ASSIGNABLE_ROLES)
  role: AssignableRole;
}

export class AcceptInviteDto {
  @ApiProperty({ description: 'Token recebido no convite.' })
  @IsString()
  @Length(10, 200)
  token: string;

  @ApiPropertyOptional({ description: 'Obrigatório quando ainda não existe conta.' })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @ApiPropertyOptional({ description: 'Obrigatória quando ainda não existe conta.' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE })
  password?: string;
}
