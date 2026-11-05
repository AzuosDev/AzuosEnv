/** Chaves de cache do TanStack Query. Toda query do app sai daqui. */
export const queryKeys = {
  session: () => ['session'] as const,
  me: () => ['me'] as const,
  sessions: () => ['sessions'] as const,
  notificationSettings: () => ['notification-settings'] as const,
  workspaces: () => ['workspaces'] as const,
  workspace: (workspaceId: string) => ['workspaces', workspaceId] as const,
  tree: (workspaceId: string) => ['workspaces', workspaceId, 'tree'] as const,
  inboxCounts: (workspaceId: string) => ['workspaces', workspaceId, 'inbox', 'counts'] as const,
  members: (workspaceId: string) => ['workspaces', workspaceId, 'members'] as const,
  invites: (workspaceId: string) => ['workspaces', workspaceId, 'invites'] as const,
  teams: (workspaceId: string) => ['workspaces', workspaceId, 'teams'] as const,
} as const;
