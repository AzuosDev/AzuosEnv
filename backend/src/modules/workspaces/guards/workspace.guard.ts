import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { WorkspaceRequest } from '../workspace-context';
import { WorkspaceRole, hasRoleAtLeast } from '../workspace-roles';
import { WorkspacesService } from '../workspaces.service';

/**
 * Resolves :wsId, requires an active membership (404 otherwise), attaches
 * `req.workspace`/`req.membership` and enforces the minimum role of @Roles().
 */
@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly workspaces: WorkspacesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<WorkspaceRequest>();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Não autenticado.' });
    }

    const params = request.params as Record<string, string | undefined>;
    const resolved = await this.workspaces.resolveContext(params.wsId, user.id);

    request.workspace = resolved.workspace;
    request.membership = resolved.membership;

    const required = this.reflector.getAllAndOverride<WorkspaceRole | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (required && !hasRoleAtLeast(resolved.membership.role, required)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ROLE',
        message: 'Você não tem permissão para esta ação.',
      });
    }

    return true;
  }
}
