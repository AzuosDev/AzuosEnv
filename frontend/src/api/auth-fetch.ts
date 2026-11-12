export type FetchLike = (input: Request) => Promise<Response>;

export interface AuthFetchDeps {
  /** fetch de verdade; injetado para o teste. */
  fetch: FetchLike;
  getToken: () => string | null;
  setToken: (token: string | null) => void;
  /** Renova a sessão pelo cookie httpOnly e devolve o novo access token. */
  refresh: () => Promise<string | null>;
  /** Chamado quando a renovação falha e a sessão acabou. */
  onSessionLost: () => void;
}

/** Rotas que nunca disparam renovação: o 401 delas é a resposta final. */
const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/invites/accept',
];

function isPublic(url: string): boolean {
  const path = new URL(url, 'http://local').pathname;

  return PUBLIC_PATHS.some((suffix) => path.endsWith(suffix));
}

function withToken(request: Request, token: string | null): Request {
  const headers = new Headers(request.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    headers.delete('Authorization');
  }

  return new Request(request, { headers });
}

/**
 * fetch do cliente da API: assina com o access token e, em 401, renova a
 * sessão uma única vez (single-flight) e repete a chamada. Chamadas paralelas
 * que tomam 401 juntas compartilham a mesma renovação.
 */
export function createAuthFetch(deps: AuthFetchDeps): FetchLike {
  let inflight: Promise<string | null> | null = null;

  const refreshOnce = (): Promise<string | null> => {
    inflight ??= deps
      .refresh()
      .then((token) => {
        deps.setToken(token);

        return token;
      })
      .catch(() => {
        deps.setToken(null);

        return null;
      })
      .finally(() => {
        inflight = null;
      });

    return inflight;
  };

  return async (input) => {
    const retryable = input.clone();
    const response = await deps.fetch(withToken(input, deps.getToken()));

    if (response.status !== 401 || isPublic(input.url)) {
      return response;
    }

    const token = await refreshOnce();

    if (!token) {
      deps.onSessionLost();

      return response;
    }

    return deps.fetch(withToken(retryable, token));
  };
}
