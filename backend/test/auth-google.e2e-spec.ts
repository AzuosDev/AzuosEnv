import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { GoogleIdentity } from '../src/modules/auth/google/google-login.provider';
import { encodeMockGoogleCode } from '../src/modules/auth/google/mock-google-login.provider';
import { GOOGLE_STATE_COOKIE } from '../src/modules/auth/google/google-login.state';
import { createTestApp, TestApp } from './utils/e2e-app';
import {
  DEFAULT_PASSWORD,
  Session,
  createSession,
  nextIp,
  refreshCookieOf,
  registerUser,
  uniqueEmail,
} from './utils/auth-client';

const SUCCESS_URL = 'http://localhost:5173/auth/callback';
const ERROR_URL = 'http://localhost:5173/login?erro=google';

interface StartedLogin {
  state: string;
  cookie: string;
  ip: string;
}

describe('Login com Google', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterEach(async () => {
    await ctx.clearDatabase();
  });

  afterAll(async () => {
    await ctx.close();
  });

  const http = (): request.Agent => request(ctx.httpServer as never);

  function cookieOf(response: request.Response, name: string): string {
    const raw = response.headers['set-cookie'] as unknown as string[] | undefined;
    const cookie = (raw ?? []).find((value) => value.startsWith(`${name}=`));

    if (!cookie) {
      throw new Error(`Cookie ${name} ausente na resposta.`);
    }

    return cookie.split(';')[0];
  }

  async function startLogin(query = ''): Promise<StartedLogin> {
    const ip = nextIp();
    const response = await http()
      .get(`/api/v1/auth/google${query}`)
      .set('X-Forwarded-For', ip)
      .expect(302);
    const location = new URL(response.headers.location as string);

    return {
      state: location.searchParams.get('state') ?? '',
      cookie: cookieOf(response, GOOGLE_STATE_COOKIE),
      ip,
    };
  }

  function callback(
    started: StartedLogin,
    identity: Partial<GoogleIdentity>,
    overrides: { state?: string; cookie?: string | null } = {},
  ): request.Test {
    const code = encodeMockGoogleCode(identity);
    const state = overrides.state ?? started.state;
    const test = http()
      .get(
        `/api/v1/auth/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(
          state,
        )}`,
      )
      .set('X-Forwarded-For', started.ip);
    const cookie = overrides.cookie === undefined ? started.cookie : overrides.cookie;

    return cookie ? test.set('Cookie', cookie) : test;
  }

  /** Access token da sessão aberta pelo Google (o refresh vem só no cookie). */
  async function accessTokenOf(response: request.Response, ip: string): Promise<string> {
    const refreshed = await http()
      .post('/api/v1/auth/refresh')
      .set('X-Forwarded-For', ip)
      .set('Cookie', refreshCookieOf(response))
      .expect(200);

    return refreshed.body.accessToken as string;
  }

  it('cria a conta na primeira entrada pelo Google', async () => {
    const started = await startLogin();
    const email = uniqueEmail();

    const response = await callback(started, {
      googleId: `sub-${randomUUID()}`,
      email,
      name: 'Felipe Souza',
      picture: 'https://example.test/felipe.png',
    }).expect(302);

    expect(response.headers.location).toBe(SUCCESS_URL);

    const accessToken = await accessTokenOf(response, started.ip);
    const me = await http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Forwarded-For', started.ip)
      .expect(200);

    expect(me.body).toMatchObject({
      email,
      name: 'Felipe Souza',
      avatarUrl: 'https://example.test/felipe.png',
      authProviders: ['google'],
    });
    expect(me.body.lastLoginAt).toBeTruthy();
  });

  it('vincula a conta existente pelo e-mail', async () => {
    const credentials = await registerUser(ctx);
    const started = await startLogin();

    const response = await callback(started, {
      googleId: `sub-${randomUUID()}`,
      email: credentials.email,
    }).expect(302);

    expect(response.headers.location).toBe(SUCCESS_URL);

    const accessToken = await accessTokenOf(response, started.ip);
    const me = await http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Forwarded-For', started.ip)
      .expect(200);

    expect(me.body.email).toBe(credentials.email);
    expect(me.body.authProviders).toEqual(['password', 'google']);
  });

  it('recusa a conta do Google sem e-mail verificado', async () => {
    const started = await startLogin();

    const response = await callback(started, {
      googleId: `sub-${randomUUID()}`,
      email: uniqueEmail(),
      emailVerified: false,
    }).expect(302);

    expect(response.headers.location).toBe(ERROR_URL);

    const cookies = (response.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
    expect(cookies.some((cookie) => cookie.startsWith('refresh_token=ey'))).toBe(false);
  });

  it('recusa o callback com state inválido ou sem o cookie do PKCE', async () => {
    const started = await startLogin();
    const identity = { googleId: `sub-${randomUUID()}`, email: uniqueEmail() };

    const forged = await callback(started, identity, { state: 'nao-e-um-state' }).expect(302);
    expect(forged.headers.location).toBe(ERROR_URL);

    const withoutCookie = await callback(started, identity, { cookie: null }).expect(302);
    expect(withoutCookie.headers.location).toBe(ERROR_URL);
  });

  it('ignora um next absoluto e mantém o relativo', async () => {
    const absolute = await startLogin('?next=https%3A%2F%2Fevil.test%2Froubo');
    const first = await callback(absolute, {
      googleId: `sub-${randomUUID()}`,
      email: uniqueEmail(),
    }).expect(302);

    expect(first.headers.location).toBe(SUCCESS_URL);

    const relative = await startLogin('?next=%2Fw%2F1%2Ftarefas');
    const second = await callback(relative, {
      googleId: `sub-${randomUUID()}`,
      email: uniqueEmail(),
    }).expect(302);

    expect(second.headers.location).toBe(`${SUCCESS_URL}?next=%2Fw%2F1%2Ftarefas`);
  });

  it('aceita o convite do workspace na entrada pelo Google', async () => {
    const owner: Session = await createSession(ctx);
    const workspace = await http()
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('X-Forwarded-For', owner.credentials.ip)
      .send({ name: 'Azuos Dev' })
      .expect(201);
    const email = uniqueEmail();
    const invite = await http()
      .post(`/api/v1/workspaces/${workspace.body.id as string}/invites`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('X-Forwarded-For', owner.credentials.ip)
      .send({ email, role: 'member' })
      .expect(201);

    const started = await startLogin(`?invite=${encodeURIComponent(invite.body.token as string)}`);
    const response = await callback(started, {
      googleId: `sub-${randomUUID()}`,
      email,
    }).expect(302);

    expect(response.headers.location).toBe(SUCCESS_URL);

    const accessToken = await accessTokenOf(response, started.ip);
    const mine = await http()
      .get('/api/v1/workspaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Forwarded-For', started.ip)
      .expect(200);

    expect(mine.body.items).toHaveLength(1);
    expect(mine.body.items[0].id).toBe(workspace.body.id);
  });

  it('só desvincula o Google depois de definir uma senha', async () => {
    const started = await startLogin();
    const response = await callback(started, {
      googleId: `sub-${randomUUID()}`,
      email: uniqueEmail(),
    }).expect(302);
    const accessToken = await accessTokenOf(response, started.ip);
    const authed = (test: request.Test): request.Test =>
      test.set('Authorization', `Bearer ${accessToken}`).set('X-Forwarded-For', started.ip);

    const refused = await authed(http().delete('/api/v1/users/me/google')).expect(400);
    expect(refused.body.code).toBe('PASSWORD_NOT_SET');

    await authed(http().post('/api/v1/users/me/password/set'))
      .send({ password: DEFAULT_PASSWORD })
      .expect(200);
    const already = await authed(http().post('/api/v1/users/me/password/set'))
      .send({ password: DEFAULT_PASSWORD })
      .expect(400);
    expect(already.body.code).toBe('PASSWORD_ALREADY_SET');

    await authed(http().delete('/api/v1/users/me/google')).expect(200);

    const me = await authed(http().get('/api/v1/auth/me')).expect(200);
    expect(me.body.authProviders).toEqual(['password']);
  });
});
