import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsMongoId } from 'class-validator';
import { ASSIGNABLE_ROLES, AssignableRole } from '../workspace-roles';

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
