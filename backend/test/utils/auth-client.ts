import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { REFRESH_COOKIE_NAME } from '../../src/modules/auth/auth.constants';
import { TestApp } from './e2e-app';

export const DEFAULT_PASSWORD = 'Azuos2026';

let ipCounter = 0;

/** Each test uses its own client IP so the throttler counters stay isolated. */
export function nextIp(): string {
  ipCounter += 1;
  return `10.1.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
}

export function uniqueEmail(): string {
  return `user-${randomUUID()}@azuos.dev`;
}

export function refreshCookieOf(response: request.Response): string {
  const raw = response.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = (raw ?? []).find((value) => value.startsWith(`${REFRESH_COOKIE_NAME}=`));

  if (!cookie) {
    throw new Error('Cookie de refresh ausente na resposta.');
  }

  return cookie.split(';')[0];
}

export function refreshCookieValueOf(response: request.Response): string {
  return refreshCookieOf(response).split('=')[1];
}

export interface Credentials {
  email: string;
  password: string;
  ip: string;
}

export async function registerUser(
  ctx: TestApp,
  overrides: Partial<Credentials> = {},
): Promise<Credentials> {
  const credentials: Credentials = {
    email: overrides.email ?? uniqueEmail(),
    password: overrides.password ?? DEFAULT_PASSWORD,
    ip: overrides.ip ?? nextIp(),
  };

  await request(ctx.httpServer as never)
    .post('/api/v1/auth/register')
    .set('X-Forwarded-For', credentials.ip)
    .send({ name: 'Usuário Teste', email: credentials.email, password: credentials.password })
    .expect(201);

  return credentials;
}

export function login(ctx: TestApp, credentials: Credentials): request.Test {
  return request(ctx.httpServer as never)
    .post('/api/v1/auth/login')
    .set('X-Forwarded-For', credentials.ip)
    .send({ email: credentials.email, password: credentials.password });
}

export interface Session {
  credentials: Credentials;
  accessToken: string;
  cookie: string;
}

export async function createSession(
  ctx: TestApp,
  overrides: Partial<Credentials> = {},
): Promise<Session> {
  const credentials = await registerUser(ctx, overrides);
  const response = await login(ctx, credentials).expect(200);

  return {
    credentials,
    accessToken: response.body.accessToken as string,
    cookie: refreshCookieOf(response),
  };
}
