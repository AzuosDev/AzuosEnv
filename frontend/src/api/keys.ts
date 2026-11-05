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
  space: (workspaceId: string, spaceId: string) =>
    ['workspaces', workspaceId, 'spaces', spaceId] as const,
  folder: (workspaceId: string, folderId: string) =>
    ['workspaces', workspaceId, 'folders', folderId] as const,
  list: (workspaceId: string, listId: string) =>
    ['workspaces', workspaceId, 'lists', listId] as const,
  statusSet: (workspaceId: string, statusSetId: string) =>
    ['workspaces', workspaceId, 'status-sets', statusSetId] as const,
  permissions: (workspaceId: string, resourceType: string, resourceId: string) =>
    ['workspaces', workspaceId, 'permissions', resourceType, resourceId] as const,
  archived: (workspaceId: string) => ['workspaces', workspaceId, 'archived'] as const,
  trash: (workspaceId: string) => ['workspaces', workspaceId, 'trash'] as const,
  listStatuses: (workspaceId: string, listId: string) =>
    ['workspaces', workspaceId, 'lists', listId, 'statuses'] as const,
  tags: (workspaceId: string, spaceId?: string) =>
    ['workspaces', workspaceId, 'tags', spaceId ?? 'all'] as const,
  views: (workspaceId: string, locationType: string, locationId: string) =>
    ['workspaces', workspaceId, 'views', locationType, locationId] as const,
  tasks: (workspaceId: string, params: Record<string, unknown>) =>
    ['workspaces', workspaceId, 'tasks', params] as const,
  task: (workspaceId: string, idOrCustomId: string) =>
    ['workspaces', workspaceId, 'tasks', 'detail', idOrCustomId] as const,
  subtasks: (workspaceId: string, idOrCustomId: string) =>
    ['workspaces', workspaceId, 'tasks', 'detail', idOrCustomId, 'subtasks'] as const,
  timeEntries: (workspaceId: string, taskId: string) =>
    ['workspaces', workspaceId, 'time', 'entries', taskId] as const,
  timer: (workspaceId: string) => ['workspaces', workspaceId, 'time', 'timer'] as const,
} as const;
