import { ConfigService } from '@nestjs/config';
import { CookieOptions, Response } from 'express';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from './auth.constants';

/**
 * Options shared by every auth cookie: httpOnly, `lax` by default and `none`
 * (with COOKIE_SECURE) when the front lives on another domain.
 */
export function authCookieOptions(config: ConfigService, path: string): CookieOptions {
  const domain = config.get<string>('COOKIE_DOMAIN');

  return {
    httpOnly: true,
    sameSite: config.get<'lax' | 'strict' | 'none'>('COOKIE_SAME_SITE') ?? 'lax',
    secure: config.get<boolean>('COOKIE_SECURE') ?? false,
    path,
    ...(domain ? { domain } : {}),
  };
}

export function setRefreshCookie(
  response: Response,
  config: ConfigService,
  token: string,
  maxAge: number,
): void {
  response.cookie(REFRESH_COOKIE_NAME, token, {
    ...authCookieOptions(config, REFRESH_COOKIE_PATH),
    maxAge,
  });
}

export function clearRefreshCookie(response: Response, config: ConfigService): void {
  response.clearCookie(REFRESH_COOKIE_NAME, authCookieOptions(config, REFRESH_COOKIE_PATH));
}
