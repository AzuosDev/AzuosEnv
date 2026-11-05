import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { PASSWORD_PATTERN, PASSWORD_RULE_MESSAGE } from '../../auth/dto/password.rule';
import { Invite } from '../schemas/invite.schema';
import { WorkspaceMember } from '../schemas/workspace-member.schema';
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

/** Workspace do convite aceito, no mínimo que o front precisa para seguir. */
export class AcceptedInviteWorkspaceDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Azuos Dev' })
  name: string;

  @ApiProperty({ example: 'azuos-dev' })
  slug: string;
}

/** Resultado do aceite: workspace, vínculo criado e se a conta nasceu agora. */
export class AcceptedInviteDto {
  @ApiProperty({ type: AcceptedInviteWorkspaceDto })
  workspace: AcceptedInviteWorkspaceDto;

  @ApiProperty({ type: WorkspaceMember })
  member: WorkspaceMember;

  @ApiProperty({ description: 'true quando a conta foi criada no aceite.' })
  accountCreated: boolean;
}

/** Convite recém-criado; o token aparece só nesta resposta. */
export class CreatedInviteDto {
  @ApiProperty({ type: Invite })
  invite: Invite;

  @ApiProperty({ description: 'Token do convite; não é guardado em texto puro.' })
  token: string;

  @ApiProperty({ description: 'Link enviado por e-mail ao convidado.' })
  acceptUrl: string;
}
