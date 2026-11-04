import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { WorkspaceRequest } from '../../workspaces/workspace-context';

/**
 * Runs after the WorkspaceGuard: with the ClickApp `ai` off, no AI route answers.
 */
@Injectable()
export class AiEnabledGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<WorkspaceRequest>();

    if (request.workspace?.settings?.clickApps?.ai === false) {
      throw new ForbiddenException({
        code: 'AI_DISABLED',
        message: 'O ClickApp de IA está desligado neste workspace.',
      });
    }

    return true;
  }
}
