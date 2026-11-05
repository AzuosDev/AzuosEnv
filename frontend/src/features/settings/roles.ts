import type { StatusTone } from '@/components/ui/status-pill';
import type { AssignableRole, MemberStatus, WorkspaceRole } from '@/api/types';

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: 'Proprietário',
  admin: 'Admin',
  member: 'Membro',
  limited: 'Membro limitado',
  guest: 'Convidado',
};

/** Papéis que podem ser atribuídos; o de proprietário só muda por transferência. */
export const ASSIGNABLE_ROLES: AssignableRole[] = ['admin', 'member', 'limited', 'guest'];

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  active: 'Ativo',
  invited: 'Convite enviado',
  deactivated: 'Desativado',
};

export const MEMBER_STATUS_TONES: Record<MemberStatus, StatusTone> = {
  active: 'success',
  invited: 'warning',
  deactivated: 'neutral',
};

/** Owner e admin administram o workspace; member, limited e guest não. */
export function canAdmin(role: WorkspaceRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function isOwner(role: WorkspaceRole): boolean {
  return role === 'owner';
}
