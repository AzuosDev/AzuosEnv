import { api } from '@/api/client';
import { unwrap } from '@/api/errors';
import { setAccessToken } from '@/api/token-store';
import type {
  AcceptedInvite,
  AcceptInviteInput,
  AuthUser,
  LoginInput,
  RegisterInput,
} from '@/api/types';

/** Entra e guarda o access token em memória. */
export async function login(body: LoginInput): Promise<AuthUser> {
  const session = unwrap(await api.POST('/api/v1/auth/login', { body }));

  setAccessToken(session.accessToken);

  return session.user;
}

/** Cria a conta; não abre sessão (o login vem depois). */
export async function register(body: RegisterInput): Promise<AuthUser> {
  return unwrap(await api.POST('/api/v1/auth/register', { body })).user;
}

export async function acceptInvite(body: AcceptInviteInput): Promise<AcceptedInvite> {
  return unwrap(await api.POST('/api/v1/invites/accept', { body }));
}

/** Encerra a sessão atual e limpa o token da memória. */
export async function logout(): Promise<void> {
  await api.POST('/api/v1/auth/logout');
  setAccessToken(null);
}

/** Encerra a sessão em todos os dispositivos. */
export async function logoutAll(): Promise<void> {
  await api.POST('/api/v1/auth/logout-all');
  setAccessToken(null);
}
