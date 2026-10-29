import request from 'supertest';
import { createTestApp, TestApp } from './utils/e2e-app';

describe('GET /api/v1/health', () => {
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

  it('returns ok with the database up', async () => {
    const response = await request(ctx.httpServer as never)
      .get('/api/v1/health')
      .expect(200);

    expect(response.body).toEqual({ status: 'ok', db: 'up' });
  });

  it('returns the global error shape for an unknown route', async () => {
    const response = await request(ctx.httpServer as never)
      .get('/api/v1/unknown')
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: expect.any(String),
    });
  });
});
