/** Entities an admin action can touch. */
export const AUDIT_ENTITY_TYPES = [
  'workspace',
  'member',
  'invite',
  'team',
  'resource',
  'integration',
  'webhook',
  'import',
  'export',
] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

/** Admin actions written to audit_logs. */
export const AUDIT_ACTIONS = [
  'workspace.updated',
  'workspace.deleted',
  'workspace.ownership.transferred',
  'workspace.exported',
  'workspace.imported',
  'member.role.changed',
  'member.deactivated',
  'invite.created',
  'invite.revoked',
  'team.deleted',
  'resource.purged',
  'integration.github.created',
  'integration.github.updated',
  'integration.github.deleted',
  'integration.google.disconnected',
  'webhook.created',
  'webhook.updated',
  'webhook.deleted',
  'webhook.redelivered',
  'integration.google.calendar.changed',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Keys whose value never reaches the audit log. */
const SENSITIVE_KEY = /secret|token|password|passphrase|credential|signature|apikey|api_key|key$/i;

const MAX_DETAIL_DEPTH = 4;
const MAX_DETAIL_STRING = 200;

/**
 * Snapshot of what the request carried, with every secret removed. Only scalars
 * survive, so a Mixed payload cannot grow the log without limit.
 */
export function auditDetails(input: unknown): Record<string, unknown> {
  const redacted = redact(input, 0);

  return redacted && typeof redacted === 'object' && !Array.isArray(redacted)
    ? (redacted as Record<string, unknown>)
    : {};
}

function redact(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return value.length > MAX_DETAIL_STRING ? `${value.slice(0, MAX_DETAIL_STRING)}…` : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (depth >= MAX_DETAIL_DEPTH) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => redact(item, depth + 1));
  }

  if (typeof value !== 'object') {
    return undefined;
  }

  const out: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = '[redacted]';

      continue;
    }

    const cleaned = redact(item, depth + 1);

    if (cleaned !== undefined) {
      out[key] = cleaned;
    }
  }

  return out;
}
