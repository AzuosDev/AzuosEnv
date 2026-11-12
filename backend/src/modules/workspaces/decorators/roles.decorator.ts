import { SetMetadata } from '@nestjs/common';
import { WorkspaceRole } from '../workspace-roles';

export const ROLES_KEY = 'workspaceRole';

/** Minimum role required by the route (owner > admin > member > limited > guest). */
export const Roles = (role: WorkspaceRole): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, role);
