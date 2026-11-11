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
  comments: (workspaceId: string, idOrCustomId: string) =>
    ['workspaces', workspaceId, 'tasks', 'detail', idOrCustomId, 'comments'] as const,
  taskActivity: (workspaceId: string, idOrCustomId: string) =>
    ['workspaces', workspaceId, 'tasks', 'detail', idOrCustomId, 'activity'] as const,
  attachments: (workspaceId: string, idOrCustomId: string) =>
    ['workspaces', workspaceId, 'tasks', 'detail', idOrCustomId, 'attachments'] as const,
  dependencies: (workspaceId: string, idOrCustomId: string) =>
    ['workspaces', workspaceId, 'tasks', 'detail', idOrCustomId, 'dependencies'] as const,
  customFields: (workspaceId: string, scope: string, scopeId: string) =>
    ['workspaces', workspaceId, 'custom-fields', scope, scopeId] as const,
  timeEntries: (workspaceId: string, taskId: string) =>
    ['workspaces', workspaceId, 'time', 'entries', taskId] as const,
  timer: (workspaceId: string) => ['workspaces', workspaceId, 'time', 'timer'] as const,
  workload: (workspaceId: string, params: Record<string, unknown>) =>
    ['workspaces', workspaceId, 'workload', params] as const,
  activityFeed: (workspaceId: string, params: Record<string, unknown>) =>
    ['workspaces', workspaceId, 'activity', params] as const,
  taskDependencies: (workspaceId: string, taskIds: string[]) =>
    ['workspaces', workspaceId, 'dependencies', taskIds.join(',')] as const,
  inbox: (workspaceId: string, tab: string) =>
    ['workspaces', workspaceId, 'inbox', 'list', tab] as const,
  replies: (workspaceId: string) => ['workspaces', workspaceId, 'replies'] as const,
  assignedComments: (workspaceId: string, status: string) =>
    ['workspaces', workspaceId, 'assigned-comments', status] as const,
  reminders: (workspaceId: string, status: string) =>
    ['workspaces', workspaceId, 'reminders', status] as const,
  myTasks: (workspaceId: string) => ['workspaces', workspaceId, 'my-tasks'] as const,
  favorites: (workspaceId: string) => ['workspaces', workspaceId, 'favorites'] as const,
  recent: (workspaceId: string) => ['workspaces', workspaceId, 'recent'] as const,
  search: (workspaceId: string, term: string) =>
    ['workspaces', workspaceId, 'search', term] as const,
  timesheet: (workspaceId: string, userId: string, weekStart: string) =>
    ['workspaces', workspaceId, 'timesheets', 'grid', userId, weekStart] as const,
  weekEntries: (workspaceId: string, userId: string, weekStart: string) =>
    ['workspaces', workspaceId, 'timesheets', 'entries', userId, weekStart] as const,
  timesheetApprovals: (workspaceId: string) =>
    ['workspaces', workspaceId, 'timesheets', 'approvals'] as const,
  dashboards: (workspaceId: string) => ['workspaces', workspaceId, 'dashboards'] as const,
  dashboard: (workspaceId: string, dashboardId: string) =>
    ['workspaces', workspaceId, 'dashboards', dashboardId] as const,
  cardData: (workspaceId: string, dashboardId: string, cardId: string, params: unknown) =>
    ['workspaces', workspaceId, 'dashboards', dashboardId, 'cards', cardId, params] as const,
  automations: (workspaceId: string, params: Record<string, unknown>) =>
    ['workspaces', workspaceId, 'automations', params] as const,
  automation: (workspaceId: string, automationId: string) =>
    ['workspaces', workspaceId, 'automations', 'detail', automationId] as const,
  automationRuns: (workspaceId: string, automationId: string) =>
    ['workspaces', workspaceId, 'automations', 'detail', automationId, 'runs'] as const,
  automationRecipes: (workspaceId: string) =>
    ['workspaces', workspaceId, 'automations', 'recipes'] as const,
  templates: (workspaceId: string, type: string) =>
    ['workspaces', workspaceId, 'templates', type] as const,
  channels: (workspaceId: string, params: Record<string, unknown>) =>
    ['workspaces', workspaceId, 'channels', 'list', params] as const,
  channel: (workspaceId: string, channelId: string) =>
    ['workspaces', workspaceId, 'channels', 'detail', channelId] as const,
  messages: (workspaceId: string, channelId: string) =>
    ['workspaces', workspaceId, 'channels', 'detail', channelId, 'messages'] as const,
  channelAttachments: (workspaceId: string, channelId: string) =>
    ['workspaces', workspaceId, 'channels', 'detail', channelId, 'attachments'] as const,
  messageReplies: (workspaceId: string, messageId: string) =>
    ['workspaces', workspaceId, 'messages', messageId, 'replies'] as const,
  chatActivity: (workspaceId: string) => ['workspaces', workspaceId, 'chat-activity'] as const,
  docs: (workspaceId: string, tab: string, locationType?: string, locationId?: string) =>
    ['workspaces', workspaceId, 'docs', tab, locationType ?? 'any', locationId ?? 'any'] as const,
  doc: (workspaceId: string, docId: string) =>
    ['workspaces', workspaceId, 'docs', 'detail', docId] as const,
  docPages: (workspaceId: string, docId: string) =>
    ['workspaces', workspaceId, 'docs', 'detail', docId, 'pages'] as const,
  docPage: (workspaceId: string, pageId: string) =>
    ['workspaces', workspaceId, 'pages', pageId] as const,
  pageComments: (workspaceId: string, pageId: string) =>
    ['workspaces', workspaceId, 'pages', pageId, 'comments'] as const,
  pageVersions: (workspaceId: string, pageId: string) =>
    ['workspaces', workspaceId, 'pages', pageId, 'versions'] as const,
  publicDoc: (token: string) => ['public', 'docs', token] as const,
  planner: (workspaceId: string, from: string, to: string) =>
    ['workspaces', workspaceId, 'planner', from, to] as const,
  calendarEvents: (workspaceId: string, from: string, to: string) =>
    ['workspaces', workspaceId, 'calendar', from, to] as const,
  goalFolders: (workspaceId: string) => ['workspaces', workspaceId, 'goal-folders'] as const,
  goals: (workspaceId: string, params: Record<string, unknown>) =>
    ['workspaces', workspaceId, 'goals', params] as const,
  goal: (workspaceId: string, goalId: string) =>
    ['workspaces', workspaceId, 'goals', 'detail', goalId] as const,
  forms: (workspaceId: string) => ['workspaces', workspaceId, 'forms'] as const,
  form: (workspaceId: string, formId: string) =>
    ['workspaces', workspaceId, 'forms', 'detail', formId] as const,
  publicForm: (token: string) => ['public', 'forms', token] as const,
  sprintFolders: (workspaceId: string) => ['workspaces', workspaceId, 'sprint-folders'] as const,
  sprintFolder: (workspaceId: string, sprintFolderId: string) =>
    ['workspaces', workspaceId, 'sprint-folders', 'detail', sprintFolderId] as const,
} as const;
