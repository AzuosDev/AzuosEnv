import request from 'supertest';
import { createTestApp, TestApp } from './utils/e2e-app';
import { createSession, DEFAULT_PASSWORD, login } from './utils/auth-client';

describe('Users', () => {
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

  describe('PATCH /users/me', () => {
    it('updates the profile', async () => {
      const session = await createSession(ctx);

      const response = await http()
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          name: 'Felipe S.',
          avatarUrl: 'https://cdn.azuos.dev/avatars/felipe.png',
          timezone: 'America/Sao_Paulo',
          locale: 'en-US',
          theme: 'light',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        name: 'Felipe S.',
        avatarUrl: 'https://cdn.azuos.dev/avatars/felipe.png',
        timezone: 'America/Sao_Paulo',
        locale: 'en-US',
        theme: 'light',
      });
    });

    it('removes the avatar with an empty avatarUrl', async () => {
      const session = await createSession(ctx);
      const headers = { Authorization: `Bearer ${session.accessToken}` };

      await http()
        .patch('/api/v1/users/me')
        .set(headers)
        .send({ avatarUrl: 'https://cdn.azuos.dev/avatars/felipe.png' })
        .expect(200);

      const response = await http()
        .patch('/api/v1/users/me')
        .set(headers)
        .send({ avatarUrl: '' })
        .expect(200);

      expect(response.body.avatarUrl).toBeUndefined();
    });

    it('rejects an invalid avatar url', async () => {
      const session = await createSession(ctx);

      const response = await http()
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ avatarUrl: 'nao-e-url' })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects an unknown theme', async () => {
      const session = await createSession(ctx);

      const response = await http()
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ theme: 'neon' })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects a request without a token', async () => {
      const response = await http().patch('/api/v1/users/me').send({ name: 'Anônimo' }).expect(401);

      expect(response.body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('PATCH /users/me/password', () => {
    it('changes the password and revokes every session', async () => {
      const session = await createSession(ctx);
      const newPassword = 'NovaSenha2026';

      await http()
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ currentPassword: session.credentials.password, newPassword })
        .expect(200);

      await http()
        .post('/api/v1/auth/refresh')
        .set('X-Forwarded-For', session.credentials.ip)
        .set('Cookie', session.cookie)
        .expect(401);

      await login(ctx, { ...session.credentials, password: DEFAULT_PASSWORD }).expect(401);
      await login(ctx, { ...session.credentials, password: newPassword }).expect(200);
    });

    it('rejects a wrong current password', async () => {
      const session = await createSession(ctx);

      const response = await http()
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ currentPassword: 'Errada2026', newPassword: 'NovaSenha2026' })
        .expect(400);

      expect(response.body.code).toBe('INVALID_PASSWORD');
    });

    it('rejects a weak new password', async () => {
      const session = await createSession(ctx);

      const response = await http()
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ currentPassword: session.credentials.password, newPassword: 'curta1' })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects a request without a token', async () => {
      await http()
        .patch('/api/v1/users/me/password')
        .send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'NovaSenha2026' })
        .expect(401);
    });
  });
});
