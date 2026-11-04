import { SetMetadata } from '@nestjs/common';
import { AuditAction, AuditEntityType } from './audit-fields';

export const AUDIT_KEY = 'auditAction';

export interface AuditSpec {
  action: AuditAction;
  entityType: AuditEntityType;
  /** Route param that holds the id of the touched entity. */
  param?: string;
}

/** Marks a route whose success is written to audit_logs by the AuditInterceptor. */
export const Audit = (
  action: AuditAction,
  entityType: AuditEntityType,
  param?: string,
): MethodDecorator => SetMetadata(AUDIT_KEY, { action, entityType, param } satisfies AuditSpec);
