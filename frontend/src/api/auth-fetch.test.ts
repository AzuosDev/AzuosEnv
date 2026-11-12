import { describe, expect, it, vi } from 'vitest';
import { createAuthFetch, type FetchLike } from './auth-fetch';

interface Harness {
  authFetch: FetchLike;
  refreshes: () => number;
  calls: () => string[];
  sessionLost: () => number;
}

/**
 * fetch falso: responde 401 enquanto o token não for o renovado.
 * `refreshResult` null simula refresh expirado.
 */
function harness(refreshResult: string | null = 'token-novo'): Harness {
  let token: string | null = 'token-velho';
  let refreshes = 0;
  let sessionLost = 0;
  const calls: string[] = [];

  const fetchMock = vi.fn<FetchLike>(async (request) => {
    calls.push(request.headers.get('Authorization') ?? 'sem-token');

    const authorized = request.headers.get('Authorization') === 'Bearer token-novo';

    return new Response(authorized ? '{"ok":true}' : '{"code":"UNAUTHORIZED"}', {
      status: authorized ? 200 : 401,
      headers: { 'content-type': 'application/json' },
    });
  });

  const authFetch = createAuthFetch({
    fetch: fetchMock,
    getToken: () => token,
    setToken: (next) => {
      token = next;
    },
    refresh: async () => {
      refreshes += 1;

      await Promise.resolve();

      return refreshResult;
    },
    onSessionLost: () => {
      sessionLost += 1;
    },
  });

  return {
    authFetch,
    refreshes: () => refreshes,
    calls: () => calls,
    sessionLost: () => sessionLost,
  };
}

describe('createAuthFetch', () => {
  it('assina a chamada com o access token em memória', async () => {
    const { authFetch, calls } = harness();

    await authFetch(new Request('http://api.test/api/v1/workspaces'));

    expect(calls()[0]).toBe('Bearer token-velho');
  });

  it('renova uma única vez para três chamadas paralelas com 401', async () => {
    const { authFetch, refreshes, calls } = harness();

    const responses = await Promise.all([
      authFetch(new Request('http://api.test/api/v1/workspaces')),
      authFetch(new Request('http://api.test/api/v1/auth/me')),
      authFetch(new Request('http://api.test/api/v1/workspaces')),
    ]);

    expect(refreshes()).toBe(1);
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
    expect(calls().filter((header) => header === 'Bearer token-novo')).toHaveLength(3);
  });

  it('refresh expirado avisa a perda de sessão e devolve o 401', async () => {
    const { authFetch, refreshes, sessionLost } = harness(null);

    const response = await authFetch(new Request('http://api.test/api/v1/workspaces'));

    expect(response.status).toBe(401);
    expect(refreshes()).toBe(1);
    expect(sessionLost()).toBe(1);
  });

  it('não renova no 401 das rotas públicas', async () => {
    const { authFetch, refreshes } = harness();

    const response = await authFetch(
      new Request('http://api.test/api/v1/auth/login', { method: 'POST' }),
    );

    expect(response.status).toBe(401);
    expect(refreshes()).toBe(0);
  });
});
