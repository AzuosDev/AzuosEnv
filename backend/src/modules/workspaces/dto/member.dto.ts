import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsMongoId } from 'class-validator';
import { MEMBER_STATUSES, WorkspaceMemberStatus } from '../schemas/workspace-member.schema';
import {
  ASSIGNABLE_ROLES,
  AssignableRole,
  WORKSPACE_ROLES,
  WorkspaceRole,
} from '../workspace-roles';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: ASSIGNABLE_ROLES })
  @IsIn(ASSIGNABLE_ROLES)
  role: AssignableRole;
}

export class TransferOwnershipDto {
  @ApiProperty({ description: 'Usuário que receberá a posse; deve ser membro ativo.' })
  @IsMongoId()
  userId: string;
}

/** Usuário do membro, como o populate da listagem devolve. */
export class MemberUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Felipe Souza' })
  name: string;

  @ApiProperty({ format: 'email', example: 'felipe@azuos.dev' })
  email: string;

  @ApiPropertyOptional({ format: 'uri' })
  avatarUrl?: string;

  @ApiPropertyOptional({ example: 'America/Fortaleza' })
  timezone?: string;
}

/** Membro do workspace com o usuário já resolvido. */
export class WorkspaceMemberWithUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  workspaceId: string;

  @ApiProperty({ type: MemberUserDto })
  userId: MemberUserDto;

  @ApiProperty({ enum: WORKSPACE_ROLES })
  role: WorkspaceRole;

  @ApiProperty({ enum: MEMBER_STATUSES })
  status: WorkspaceMemberStatus;

  @ApiProperty({ example: 8 })
  capacityPerDay: number;

  @ApiPropertyOptional({ format: 'date-time' })
  joinedAt?: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}
