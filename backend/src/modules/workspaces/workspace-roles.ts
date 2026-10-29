export const WORKSPACE_ROLES = ['owner', 'admin', 'member', 'limited', 'guest'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

/** Roles that can be granted through an invite or a role change. */
export const ASSIGNABLE_ROLES = ['admin', 'member', 'limited', 'guest'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

const ROLE_RANK: Record<WorkspaceRole, number> = {
  owner: 5,
  admin: 4,
  member: 3,
  limited: 2,
  guest: 1,
};

export function roleRank(role: WorkspaceRole): number {
  return ROLE_RANK[role];
}

/** True when `role` is at least as powerful as `required`. */
export function hasRoleAtLeast(role: WorkspaceRole, required: WorkspaceRole): boolean {
  return roleRank(role) >= roleRank(required);
}

export function isRoleAbove(role: WorkspaceRole, other: WorkspaceRole): boolean {
  return roleRank(role) > roleRank(other);
}
