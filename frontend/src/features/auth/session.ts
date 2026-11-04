import { queryOptions, useQuery, type QueryClient } from '@tanstack/react-query';
import { api, requestRefresh } from '@/api/client';
import { queryKeys } from '@/api/keys';
import { getAccessToken, setAccessToken } from '@/api/token-store';
import type { AuthUser } from '@/api/types';

/**
 * Restaura a sessão: com token em memória confere no /auth/me; sem token,
 * tenta o refresh silencioso pelo cookie httpOnly.
 */
export async function loadSession(): Promise<AuthUser | null> {
  if (!getAccessToken()) {
    const session = await requestRefresh();

    if (!session) {
      return null;
    }

    setAccessToken(session.accessToken);

    return session.user;
  }

  const result = await api.GET('/api/v1/auth/me');

  if (!result.response.ok || !result.data) {
    setAccessToken(null);

    return null;
  }

  return result.data;
}

export const sessionQuery = queryOptions({
  queryKey: queryKeys.session(),
  queryFn: loadSession,
  staleTime: Infinity,
  gcTime: Infinity,
  retry: false,
});

export function ensureSession(queryClient: QueryClient): Promise<AuthUser | null> {
  return queryClient.ensureQueryData(sessionQuery);
}

/** Grava a sessão no cache depois de login, cadastro ou logout. */
export function setSession(queryClient: QueryClient, user: AuthUser | null): void {
  queryClient.setQueryData(sessionQuery.queryKey, user);
}

/** Usuário da sessão para a UI; null quando anônimo. */
export function useSession(): AuthUser | null {
  return useQuery(sessionQuery).data ?? null;
}
