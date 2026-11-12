import createClient from 'openapi-fetch';
import { createAuthFetch } from './auth-fetch';
import type { paths } from './schema';
import { getAccessToken, notifySessionLost, setAccessToken } from './token-store';
import type { AuthSession } from './types';

/** As rotas do contrato já começam em /api/v1; a env pode trazer o prefixo. */
function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
}

export const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
);

/**
 * Renova a sessão pelo cookie httpOnly. Vai por fetch puro para não reentrar
 * no interceptor de 401.
 */
export async function requestRefresh(): Promise<AuthSession | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as AuthSession;
  } catch {
    return null;
  }
}

/**
 * fetch assinado da API: também serve ao stream SSE da IA, que não passa pelo
 * cliente tipado porque a resposta não é JSON.
 */
export const apiFetch = createAuthFetch({
  fetch: (request) => fetch(request),
  getToken: getAccessToken,
  setToken: setAccessToken,
  refresh: async () => (await requestRefresh())?.accessToken ?? null,
  onSessionLost: notifySessionLost,
});

/**
 * Cliente tipado da API. O refresh vem por cookie httpOnly, por isso toda
 * requisição vai com credentials: 'include'.
 */
export const api = createClient<paths>({
  baseUrl: API_BASE_URL,
  credentials: 'include',
  fetch: apiFetch,
});
