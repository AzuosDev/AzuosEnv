import { getConnectionToken } from '@nestjs/mongoose';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Connection } from 'mongoose';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';

export interface TestApp {
  app: NestExpressApplication;
  connection: Connection;
  httpServer: unknown;
  clearDatabase(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Boots the application against the in-memory MongoDB started by the global setup.
 */
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();

  configureApp(app, { swagger: false });
  await app.init();

  const connection = app.get<Connection>(getConnectionToken());

  return {
    app,
    connection,
    httpServer: app.getHttpServer(),
    async clearDatabase(): Promise<void> {
      const collections = await connection.db?.collections();
      await Promise.all((collections ?? []).map((collection) => collection.deleteMany({})));
    },
    async close(): Promise<void> {
      await app.close();
    },
  };
}
