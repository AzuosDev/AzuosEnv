import type { components, paths } from './schema';

/**
 * Convenção da API: toda resposta de documento também traz id, createdAt e
 * updatedAt (está na descrição do contrato), que o Swagger não declara nos
 * modelos do Mongoose.
 */
export type Doc<T> = T & { id: string; createdAt: string; updatedAt: string };

export type AuthUser = components['schemas']['AuthUserDto'];
export type AuthSession = components['schemas']['AuthResponseDto'];
export type ApiErrorBody = components['schemas']['ApiErrorDto'];
export type Workspace = Doc<components['schemas']['Workspace']>;
export type AcceptedInvite = components['schemas']['AcceptedInviteDto'];
export type CreateWorkspaceInput = components['schemas']['CreateWorkspaceDto'];
export type LoginInput = components['schemas']['LoginDto'];
export type RegisterInput = components['schemas']['RegisterDto'];
export type AcceptInviteInput = components['schemas']['AcceptInviteDto'];
export type WorkspaceTree = components['schemas']['WorkspaceTreeDto'];
export type TreeSpace = components['schemas']['TreeSpaceDto'];
export type TreeFolder = components['schemas']['TreeFolderDto'];
export type TreeList = components['schemas']['TreeListDto'];
export type InboxCounts = components['schemas']['InboxCountsDto'];

export type WorkspaceRole = components['schemas']['WorkspaceWithRoleDto']['role'];
export type AssignableRole = components['schemas']['CreateInviteDto']['role'];
export type MemberStatus = components['schemas']['WorkspaceMemberWithUserDto']['status'];

/** Workspace com o papel de quem pediu; o front esconde o que o papel não permite. */
export interface WorkspaceDetail {
  workspace: Workspace;
  role: WorkspaceRole;
}

export type WorkspaceMemberItem = components['schemas']['WorkspaceMemberWithUserDto'];
export type MemberUser = components['schemas']['MemberUserDto'];
export type WorkspaceInvite = Doc<components['schemas']['Invite']>;
export type Team = Doc<components['schemas']['Team']>;
export type UserSession = components['schemas']['SessionDto'];
export type NotificationPreferences = components['schemas']['NotificationPreferencesDto'];
export type NotificationChannels = components['schemas']['NotificationChannelsStateDto'];
export type NotificationKind = keyof NotificationPreferences;

export type UpdateProfileInput = components['schemas']['UpdateProfileDto'];
export type ChangePasswordInput = components['schemas']['ChangePasswordDto'];
export type UpdateWorkspaceInput = components['schemas']['UpdateWorkspaceDto'];
export type CreateInviteInput = components['schemas']['CreateInviteDto'];
export type CreateTeamInput = components['schemas']['CreateTeamDto'];
export type UpdateTeamInput = components['schemas']['UpdateTeamDto'];
export type UpdateNotificationSettingsInput =
  components['schemas']['UpdateNotificationSettingsDto'];
export type UserTheme = NonNullable<UpdateProfileInput['theme']>;

/* Hierarquia: Spaces, Folders, Lists, statuses e compartilhamento ------- */

export type Space = Doc<components['schemas']['Space']>;
export type Folder = Doc<components['schemas']['Folder']>;
export type ListNode = Doc<components['schemas']['List']>;
export type CreateSpaceInput = components['schemas']['CreateSpaceDto'];
export type UpdateSpaceInput = components['schemas']['UpdateSpaceDto'];
export type CreateFolderInput = components['schemas']['CreateFolderDto'];
export type UpdateFolderInput = components['schemas']['UpdateFolderDto'];
export type MoveFolderInput = components['schemas']['MoveFolderDto'];
export type CreateListInput = components['schemas']['CreateListDto'];
export type UpdateListInput = components['schemas']['UpdateListDto'];
export type MoveListInput = components['schemas']['MoveListDto'];
export type ReorderInput = components['schemas']['ReorderDto'];
export type StatusTemplate = NonNullable<CreateSpaceInput['statusTemplate']>;

export type Status = components['schemas']['Status'];
export type StatusGroup = Status['group'];
export type StatusSet = Doc<components['schemas']['StatusSet']>;
export type StatusInput = components['schemas']['StatusDto'];
export type CreateStatusSetInput = components['schemas']['CreateStatusSetDto'];
export type UpdateStatusSetInput = components['schemas']['UpdateStatusSetDto'];
export type EffectiveStatuses = components['schemas']['EffectiveStatusesDto'];
export type EffectiveStatus = components['schemas']['EffectiveStatusDto'];
export type StatusSource = EffectiveStatuses['source'];

export type Permission = Doc<components['schemas']['Permission']>;
export type ShareInput = components['schemas']['ShareDto'];
export type PermissionLevel = ShareInput['level'];
export type ShareableResourceType = ShareInput['resourceType'];
export type PrincipalType = ShareInput['principalType'];

export type TrashItem = components['schemas']['TrashItemDto'];
export type TrashEntityType = TrashItem['entityType'];

/* Tarefas --------------------------------------------------------------- */

export type Task = Doc<components['schemas']['TaskListItemDto']>;
export type TaskPriority = NonNullable<Task['priority']>;
export type TaskType = Task['type'];
export type CreateTaskInput = components['schemas']['CreateTaskDto'];
export type UpdateTaskInput = components['schemas']['UpdateTaskDto'];
export type MoveTaskInput = components['schemas']['MoveTaskDto'];
export type BulkTasksInput = components['schemas']['BulkTasksDto'];
export type BulkChanges = components['schemas']['BulkChangesDto'];
export type BulkResult = components['schemas']['BulkResultDto'];
export type Tag = Doc<components['schemas']['Tag']>;

/** Parâmetros aceitos por GET /tasks/query, direto do contrato. */
export type TaskQueryParams = NonNullable<
  paths['/api/v1/workspaces/{wsId}/tasks/query']['get']['parameters']['query']
>;

/** Grupo da consulta com as tarefas já no formato de documento. */
export type TaskGroup = Omit<components['schemas']['TaskGroupDto'], 'items'> & { items: Task[] };

export type TaskQueryResult = Omit<
  components['schemas']['TaskQueryResultDto'],
  'items' | 'groups'
> & { items?: Task[]; groups?: TaskGroup[] };

/* Views ----------------------------------------------------------------- */

export type View = Doc<components['schemas']['View']>;
export type ViewType = View['type'];
export type ViewLocationType = View['locationType'];
export type ViewConfig = components['schemas']['ViewConfigDto'];
export type TaskFilters = NonNullable<ViewConfig['filters']>;
export type ViewGroupBy = NonNullable<ViewConfig['groupBy']>;
export type ViewSortBy = NonNullable<ViewConfig['sortBy']>;
export type CreateViewInput = components['schemas']['CreateViewDto'];
export type UpdateViewInput = components['schemas']['UpdateViewDto'];
