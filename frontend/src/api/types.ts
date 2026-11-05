import type { components } from './schema';

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
