/** Chaves de cache do TanStack Query. Toda query do app sai daqui. */
export const queryKeys = {
  session: () => ['session'] as const,
  me: () => ['me'] as const,
  workspaces: () => ['workspaces'] as const,
  workspace: (workspaceId: string) => ['workspaces', workspaceId] as const,
} as const;
