import request from 'supertest';
import { createTestApp, TestApp } from './utils/e2e-app';
import {
  createSession,
  DEFAULT_PASSWORD,
  login,
  nextIp,
  refreshCookieOf,
  registerUser,
  uniqueEmail,
} from './utils/auth-client';

describe('Auth', () => {
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

  describe('POST /auth/register', () => {
    it('creates the user without exposing the password hash', async () => {
      const email = uniqueEmail();

      const response = await http()
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', nextIp())
        .send({ name: 'Felipe Souza', email: email.toUpperCase(), password: DEFAULT_PASSWORD })
        .expect(201);

      expect(response.body.user).toMatchObject({
        email,
        name: 'Felipe Souza',
        timezone: 'America/Fortaleza',
        locale: 'pt-BR',
        theme: 'dark',
      });
      expect(response.body.user.passwordHash).toBeUndefined();
    });

    it('rejects a password without a number', async () => {
      const response = await http()
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', nextIp())
        .send({ name: 'Felipe Souza', email: uniqueEmail(), password: 'somenteletras' })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects a duplicated e-mail', async () => {
      const credentials = await registerUser(ctx);

      const response = await http()
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', credentials.ip)
        .send({ name: 'Outro', email: credentials.email, password: DEFAULT_PASSWORD })
        .expect(409);

      expect(response.body.code).toBe('EMAIL_IN_USE');
    });
  });

  describe('POST /auth/login', () => {
    it('returns the access token and sets the refresh cookie', async () => {
      const credentials = await registerUser(ctx);

      const response = await login(ctx, credentials).expect(200);

      expect(response.body.accessToken).toEqual(expect.any(String));
      expect(response.body.user.email).toBe(credentials.email);
      expect(response.body.user.lastLoginAt).toEqual(expect.any(String));

      const cookie = (response.headers['set-cookie'] as unknown as string[])[0];
      expect(cookie).toContain('refresh_token=');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/api/v1/auth');
      expect(cookie).not.toContain('Secure');
    });

    it('rejects wrong credentials', async () => {
      const credentials = await registerUser(ctx);

      const response = await login(ctx, { ...credentials, password: 'Errada2026' }).expect(401);

      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('limits login to 5 attempts per minute per IP', async () => {
      const credentials = await registerUser(ctx);
      const attempt = { ...credentials, password: 'Errada2026' };

      for (let i = 0; i < 5; i += 1) {
        await login(ctx, attempt).expect(401);
      }

      const response = await login(ctx, attempt).expect(429);
      expect(response.body.code).toBe('TOO_MANY_REQUESTS');
    });
  });

  describe('GET /auth/me', () => {
    it('returns the authenticated user', async () => {
      const session = await createSession(ctx);

      const response = await http()
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);

      expect(response.body.email).toBe(session.credentials.email);
      expect(response.body.passwordHash).toBeUndefined();
    });

    it('rejects a request without a token', async () => {
      const response = await http().get('/api/v1/auth/me').expect(401);

      expect(response.body.code).toBe('UNAUTHORIZED');
    });

    it('rejects an invalid token', async () => {
      await http().get('/api/v1/auth/me').set('Authorization', 'Bearer invalido').expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates the refresh token', async () => {
      const session = await createSession(ctx);

      const response = await http()
        .post('/api/v1/auth/refresh')
        .set('X-Forwarded-For', session.credentials.ip)
        .set('Cookie', session.cookie)
        .expect(200);

      const rotated = refreshCookieOf(response);

      expect(response.body.accessToken).toEqual(expect.any(String));
      expect(rotated).not.toBe(session.cookie);

      await http()
        .post('/api/v1/auth/refresh')
        .set('X-Forwarded-For', session.credentials.ip)
        .set('Cookie', rotated)
        .expect(200);
    });

    it('revokes the whole family when a revoked token is reused', async () => {
      const session = await createSession(ctx);

      const first = await http()
        .post('/api/v1/auth/refresh')
        .set('X-Forwarded-For', session.credentials.ip)
        .set('Cookie', session.cookie)
        .expect(200);

      const rotated = refreshCookieOf(first);

      const reuse = await http()
        .post('/api/v1/auth/refresh')
        .set('X-Forwarded-For', session.credentials.ip)
        .set('Cookie', session.cookie)
        .expect(401);

      expect(reuse.body.code).toBe('REFRESH_TOKEN_REUSED');

      const afterReuse = await http()
        .post('/api/v1/auth/refresh')
        .set('X-Forwarded-For', session.credentials.ip)
        .set('Cookie', rotated)
        .expect(401);

      expect(afterReuse.body.code).toBe('REFRESH_TOKEN_REUSED');
    });

    it('rejects a request without the cookie', async () => {
      const response = await http()
        .post('/api/v1/auth/refresh')
        .set('X-Forwarded-For', nextIp())
        .expect(401);

      expect(response.body.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('logout', () => {
    it('clears the cookie and revokes the current session', async () => {
      const session = await createSession(ctx);

      const response = await http()
        .post('/api/v1/auth/logout')
        .set('X-Forwarded-For', session.credentials.ip)
        .set('Cookie', session.cookie)
        .expect(200);

      expect(response.body).toEqual({ success: true });

      await http()
        .post('/api/v1/auth/refresh')
        .set('X-Forwarded-For', session.credentials.ip)
        .set('Cookie', session.cookie)
        .expect(401);
    });

    it('logout-all revokes every session of the user', async () => {
      const session = await createSession(ctx);
      const second = await login(ctx, session.credentials).expect(200);

      await http()
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);

      await http()
        .post('/api/v1/auth/refresh')
        .set('X-Forwarded-For', session.credentials.ip)
        .set('Cookie', session.cookie)
        .expect(401);

      await http()
        .post('/api/v1/auth/refresh')
        .set('X-Forwarded-For', session.credentials.ip)
        .set('Cookie', refreshCookieOf(second))
        .expect(401);
    });
  });

  describe('sessions', () => {
    it('lists the active sessions and marks the current one', async () => {
      const session = await createSession(ctx);
      await login(ctx, session.credentials).expect(200);

      const response = await http()
        .get('/api/v1/auth/sessions')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .set('Cookie', session.cookie)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.filter((item: { current: boolean }) => item.current)).toHaveLength(1);
    });

    it('revokes a session by id', async () => {
      const session = await createSession(ctx);
      const second = await login(ctx, session.credentials).expect(200);

      const list = await http()
        .get('/api/v1/auth/sessions')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .set('Cookie', session.cookie)
        .expect(200);

      const other = (list.body as { id: string; current: boolean }[]).find((item) => !item.current);

      await http()
        .delete(`/api/v1/auth/sessions/${other?.id}`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);

      await http()
        .post('/api/v1/auth/refresh')
        .set('X-Forwarded-For', session.credentials.ip)
        .set('Cookie', refreshCookieOf(second))
        .expect(401);
    });

    it('does not revoke a session of another user', async () => {
      const owner = await createSession(ctx);
      const intruder = await createSession(ctx);

      const list = await http()
        .get('/api/v1/auth/sessions')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .set('Cookie', owner.cookie)
        .expect(200);

      const response = await http()
        .delete(`/api/v1/auth/sessions/${(list.body as { id: string }[])[0].id}`)
        .set('Authorization', `Bearer ${intruder.accessToken}`)
        .expect(404);

      expect(response.body.code).toBe('SESSION_NOT_FOUND');
    });
  });
});
