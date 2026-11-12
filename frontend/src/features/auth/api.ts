import { api, API_BASE_URL } from '@/api/client';
import { unwrap } from '@/api/errors';
import { setAccessToken } from '@/api/token-store';
import type {
  AcceptedInvite,
  AcceptInviteInput,
  AuthUser,
  LoginInput,
  RegisterInput,
} from '@/api/types';
import { safeNext } from './navigation';

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

/**
 * Endereço do login com o Google. É navegação de página inteira para a API
 * (OAuth2 + PKCE), por isso sai do cliente tipado: o backend responde 302.
 * `next` só viaja quando é caminho interno.
 */
export function googleLoginUrl(params: { next?: string; invite?: string } = {}): string {
  const url = new URL(`${API_BASE_URL}/api/v1/auth/google`);
  const next = safeNext(params.next);

  if (next !== '/') {
    url.searchParams.set('next', next);
  }

  if (params.invite) {
    url.searchParams.set('invite', params.invite);
  }

  return url.toString();
}
