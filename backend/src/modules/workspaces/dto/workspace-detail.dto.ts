import { ApiProperty } from '@nestjs/swagger';
import { Workspace } from '../schemas/workspace.schema';
import { WORKSPACE_ROLES, WorkspaceRole } from '../workspace-roles';

/** Workspace com o papel de quem pediu; o front esconde o que o papel não permite. */
export class WorkspaceWithRoleDto {
  @ApiProperty({ type: Workspace })
  workspace: Workspace;

  @ApiProperty({ enum: WORKSPACE_ROLES })
  role: WorkspaceRole;
}
