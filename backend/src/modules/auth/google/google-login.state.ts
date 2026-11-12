export const GOOGLE_STATE_COOKIE = 'google_oauth';
export const GOOGLE_COOKIE_PATH = '/api/v1/auth/google';
export const GOOGLE_STATE_TTL_SECONDS = 600;

/** Claims of the signed `state` that travels to Google and comes back. */
export interface GoogleStateClaims {
  nonce: string;
  next?: string;
  invite?: string;
}

/** Claims of the httpOnly cookie: the PKCE verifier never leaves the browser. */
export interface GoogleCookieClaims {
  nonce: string;
  verifier: string;
}

/**
 * Relative path the front may be sent to after the login. Anything absolute
 * (`https://...`, `//host`) or with a backslash is dropped, so the callback can
 * never bounce the user to another site.
 */
export function safeNextPath(next: unknown): string | undefined {
  if (typeof next !== 'string') {
    return undefined;
  }

  const value = next.trim();

  if (
    value.length === 0 ||
    value.length > 512 ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    value.includes('://')
  ) {
    return undefined;
  }

  return value;
}
