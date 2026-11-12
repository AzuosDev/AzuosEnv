import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { WorkspaceRequest } from '../workspace-context';

/** Membership of the authenticated user in the workspace of the route. */
export const CurrentMembership = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<WorkspaceRequest>().membership,
);

/** Workspace of the route, already validated by the WorkspaceGuard. */
export const CurrentWorkspace = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<WorkspaceRequest>().workspace,
);
