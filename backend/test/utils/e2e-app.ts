import { getConnectionToken } from '@nestjs/mongoose';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'node:net';
import { Server } from 'node:http';
import { Connection } from 'mongoose';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';

export interface TestApp {
  app: NestExpressApplication;
  connection: Connection;
  httpServer: unknown;
  /** Only set when the app was booted with `{ listen: true }`. */
  baseUrl?: string;
  clearDatabase(): Promise<void>;
  close(): Promise<void>;
}

export interface CreateTestAppOptions {
  /** Binds a real port, needed by the Socket.IO suite. */
  listen?: boolean;
}

/**
 * Boots the application against the in-memory MongoDB started by the global setup.
 */
export async function createTestApp(options: CreateTestAppOptions = {}): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();

  configureApp(app, { swagger: false });
  await app.init();

  let baseUrl: string | undefined;

  if (options.listen) {
    await app.listen(0, '127.0.0.1');
    const address = (app.getHttpServer() as Server).address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  const connection = app.get<Connection>(getConnectionToken());

  return {
    app,
    connection,
    httpServer: app.getHttpServer(),
    baseUrl,
    async clearDatabase(): Promise<void> {
      const collections = await connection.db?.collections();
      await Promise.all((collections ?? []).map((collection) => collection.deleteMany({})));
    },
    async close(): Promise<void> {
      await app.close();
    },
  };
}
