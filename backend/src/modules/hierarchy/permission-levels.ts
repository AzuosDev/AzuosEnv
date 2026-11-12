export const PERMISSION_LEVELS = ['view', 'comment', 'edit', 'full'] as const;
export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];

export const PERMISSION_RESOURCE_TYPES = ['space', 'folder', 'list', 'task', 'doc'] as const;
export type PermissionResourceType = (typeof PERMISSION_RESOURCE_TYPES)[number];

/** Resource types that already exist and can be shared in this stage. */
export const SHAREABLE_RESOURCE_TYPES = ['space', 'folder', 'list'] as const;
export type ShareableResourceType = (typeof SHAREABLE_RESOURCE_TYPES)[number];

export const PRINCIPAL_TYPES = ['user', 'team'] as const;
export type PrincipalType = (typeof PRINCIPAL_TYPES)[number];

const LEVEL_RANK: Record<PermissionLevel, number> = {
  view: 1,
  comment: 2,
  edit: 3,
  full: 4,
};

export function levelRank(level: PermissionLevel): number {
  return LEVEL_RANK[level];
}

/** True when `level` grants at least `required`. */
export function hasLevelAtLeast(level: PermissionLevel | null, required: PermissionLevel): boolean {
  return level !== null && levelRank(level) >= levelRank(required);
}

export function maxLevel(
  a: PermissionLevel | null,
  b: PermissionLevel | null,
): PermissionLevel | null {
  if (a === null) {
    return b;
  }
  if (b === null) {
    return a;
  }
  return levelRank(a) >= levelRank(b) ? a : b;
}
