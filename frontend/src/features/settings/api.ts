import { queryOptions } from '@tanstack/react-query';
import { api } from '@/api/client';
import { unwrap } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type {
  AssignableRole,
  AuthUser,
  ChangePasswordInput,
  CreateInviteInput,
  CreateTeamInput,
  NotificationPreferences,
  SetPasswordInput,
  Team,
  UpdateNotificationSettingsInput,
  UpdateProfileInput,
  UpdateTeamInput,
  UpdateWorkspaceInput,
  UserSession,
  Workspace,
  WorkspaceDetail,
  WorkspaceInvite,
  WorkspaceMemberItem,
} from '@/api/types';

/* Perfil e preferências ------------------------------------------------- */

export async function updateProfile(body: UpdateProfileInput): Promise<AuthUser> {
  return unwrap(await api.PATCH('/api/v1/users/me', { body }));
}

export async function changePassword(body: ChangePasswordInput): Promise<void> {
  unwrap(await api.PATCH('/api/v1/users/me/password', { body }));
}

/** Primeira senha de uma conta criada pelo Google; mantém as sessões abertas. */
export async function setPassword(body: SetPasswordInput): Promise<void> {
  unwrap(await api.POST('/api/v1/users/me/password/set', { body }));
}

/** Desfaz o vínculo com o Google; exige senha definida. */
export async function disconnectGoogle(): Promise<void> {
  unwrap(await api.DELETE('/api/v1/users/me/google'));
}

/* Sessões ativas -------------------------------------------------------- */

async function loadSessions(): Promise<UserSession[]> {
  return unwrap(await api.GET('/api/v1/auth/sessions'));
}

export const sessionsQuery = queryOptions({
  queryKey: queryKeys.sessions(),
  queryFn: loadSessions,
  staleTime: 10_000,
});

export async function revokeSession(id: string): Promise<void> {
  unwrap(await api.DELETE('/api/v1/auth/sessions/{id}', { params: { path: { id } } }));
}

/* Notificações ---------------------------------------------------------- */

async function loadNotificationSettings(): Promise<NotificationPreferences> {
  return unwrap(await api.GET('/api/v1/users/me/notification-settings'));
}

export const notificationSettingsQuery = queryOptions({
  queryKey: queryKeys.notificationSettings(),
  queryFn: loadNotificationSettings,
  staleTime: 30_000,
});

export async function updateNotificationSettings(
  body: UpdateNotificationSettingsInput,
): Promise<NotificationPreferences> {
  return unwrap(await api.PATCH('/api/v1/users/me/notification-settings', { body }));
}

/* Workspace ------------------------------------------------------------- */

async function loadWorkspace(wsId: string): Promise<WorkspaceDetail> {
  const detail = unwrap(await api.GET('/api/v1/workspaces/{wsId}', { params: { path: { wsId } } }));

  return { workspace: detail.workspace as Workspace, role: detail.role };
}

export function workspaceQuery(wsId: string) {
  return queryOptions({
    queryKey: queryKeys.workspace(wsId),
    queryFn: () => loadWorkspace(wsId),
    staleTime: 30_000,
  });
}

export async function updateWorkspace(
  wsId: string,
  body: UpdateWorkspaceInput,
): Promise<Workspace> {
  return unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}', { params: { path: { wsId } }, body }),
  ) as Workspace;
}

export async function transferOwnership(wsId: string, userId: string): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/transfer-ownership', {
      params: { path: { wsId } },
      body: { userId },
    }),
  );
}

/* Pessoas --------------------------------------------------------------- */

async function loadMembers(wsId: string): Promise<WorkspaceMemberItem[]> {
  const page = unwrap(
    await api.GET('/api/v1/workspaces/{wsId}/members', {
      params: { path: { wsId }, query: { limit: 100 } },
    }),
  );

  return page.items;
}

export function membersQuery(wsId: string) {
  return queryOptions({
    queryKey: queryKeys.members(wsId),
    queryFn: () => loadMembers(wsId),
    staleTime: 30_000,
  });
}

export async function updateMemberRole(
  wsId: string,
  memberId: string,
  role: AssignableRole,
): Promise<void> {
  unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/members/{memberId}', {
      params: { path: { wsId, memberId } },
      body: { role },
    }),
  );
}

export async function deactivateMember(wsId: string, memberId: string): Promise<void> {
  unwrap(
    await api.POST('/api/v1/workspaces/{wsId}/members/{memberId}/deactivate', {
      params: { path: { wsId, memberId } },
    }),
  );
}

/* Convites -------------------------------------------------------------- */

async function loadInvites(wsId: string): Promise<WorkspaceInvite[]> {
  const page = unwrap(
    await api.GET('/api/v1/workspaces/{wsId}/invites', {
      params: { path: { wsId }, query: { limit: 100 } },
    }),
  );

  return page.items as WorkspaceInvite[];
}

export function invitesQuery(wsId: string) {
  return queryOptions({
    queryKey: queryKeys.invites(wsId),
    queryFn: () => loadInvites(wsId),
    staleTime: 30_000,
  });
}

/** Convidar de novo o mesmo e-mail invalida o convite anterior e manda outro link. */
export async function createInvite(wsId: string, body: CreateInviteInput): Promise<void> {
  unwrap(await api.POST('/api/v1/workspaces/{wsId}/invites', { params: { path: { wsId } }, body }));
}

export async function cancelInvite(wsId: string, inviteId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/invites/{inviteId}', {
      params: { path: { wsId, inviteId } },
    }),
  );
}

/* Equipes --------------------------------------------------------------- */

async function loadTeams(wsId: string): Promise<Team[]> {
  const page = unwrap(
    await api.GET('/api/v1/workspaces/{wsId}/teams', {
      params: { path: { wsId }, query: { limit: 100 } },
    }),
  );

  return page.items as Team[];
}

export function teamsQuery(wsId: string) {
  return queryOptions({
    queryKey: queryKeys.teams(wsId),
    queryFn: () => loadTeams(wsId),
    staleTime: 30_000,
  });
}

export async function createTeam(wsId: string, body: CreateTeamInput): Promise<void> {
  unwrap(await api.POST('/api/v1/workspaces/{wsId}/teams', { params: { path: { wsId } }, body }));
}

export async function updateTeam(
  wsId: string,
  teamId: string,
  body: UpdateTeamInput,
): Promise<void> {
  unwrap(
    await api.PATCH('/api/v1/workspaces/{wsId}/teams/{teamId}', {
      params: { path: { wsId, teamId } },
      body,
    }),
  );
}

export async function deleteTeam(wsId: string, teamId: string): Promise<void> {
  unwrap(
    await api.DELETE('/api/v1/workspaces/{wsId}/teams/{teamId}', {
      params: { path: { wsId, teamId } },
    }),
  );
}
