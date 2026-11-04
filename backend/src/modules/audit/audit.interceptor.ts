import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Types } from 'mongoose';
import { Observable, tap } from 'rxjs';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { WorkspaceRequest } from '../workspaces/workspace-context';
import { AUDIT_KEY, AuditSpec } from './audit.decorator';
import { auditDetails } from './audit-fields';
import { AuditService } from './audit.service';

/**
 * Writes one line in audit_logs for every route marked with `@Audit(...)`, after
 * the handler succeeded. The workspace and the actor come from what the
 * WorkspaceGuard and the JwtAuthGuard already attached to the request.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const spec = this.reflector.get<AuditSpec | undefined>(AUDIT_KEY, context.getHandler());

    if (!spec || context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<WorkspaceRequest>();
    const workspaceId = request.membership?.workspaceId;

    if (!workspaceId) {
      return next.handle();
    }

    const user = request.user as AuthenticatedUser | undefined;
    const params = request.params as Record<string, string>;
    const entityId = spec.param ? params[spec.param] : undefined;

    return next.handle().pipe(
      tap(() => {
        void this.audit.record({
          workspaceId: new Types.ObjectId(workspaceId),
          actorId: user ? new Types.ObjectId(user.id) : null,
          action: spec.action,
          entityType: spec.entityType,
          entityId:
            entityId && Types.ObjectId.isValid(entityId) ? new Types.ObjectId(entityId) : null,
          details: auditDetails({
            method: request.method,
            path: request.originalUrl,
            params,
            body: request.body,
          }),
          ip: request.ip ?? '',
          userAgent: String(request.headers['user-agent'] ?? ''),
        });
      }),
    );
  }
}
