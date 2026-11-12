import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Express } from 'express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

/**
 * Entry point of the serverless deploy (Vercel). Unlike `main.ts` nothing ever
 * listens on a port: the Express instance is handed straight to the platform,
 * which calls it once per request.
 *
 * The promise is cached at module scope so a warm instance reuses the Nest
 * container and, with it, the Mongoose connection. Every cold start pays for a
 * fresh bootstrap and opens a new connection to Atlas.
 */
let cached: Promise<Express> | undefined;

async function create(): Promise<Express> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  configureApp(app);

  // init() and not listen(): it wires the modules, the guards and the global
  // prefix without ever binding a port.
  await app.init();

  return app.getHttpAdapter().getInstance() as Express;
}

export function createHandler(): Promise<Express> {
  cached ??= create();

  return cached;
}
