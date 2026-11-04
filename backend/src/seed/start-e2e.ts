import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * API for the e2e of the front: Mongo in memory, seed applied and a fixed port.
 * No real database is touched, so the suite runs anywhere.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const logger = new Logger('StartE2E');

/** Runs the usual seed against the in-memory instance. */
function runSeed(): Promise<void> {
  return new Promise((done, reject) => {
    const child = spawn(
      process.execPath,
      [resolve(__dirname, '../../node_modules/ts-node/dist/bin.js'), resolve(__dirname, 'seed.ts')],
      { env: process.env, stdio: 'inherit' },
    );

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        done();
      } else {
        reject(new Error(`Seed falhou (status ${String(code)}).`));
      }
    });
  });
}

async function main(): Promise<void> {
  const mongo = await MongoMemoryServer.create();

  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongo.getUri('azuos-env-e2e');
  process.env.PORT = String(PORT);
  process.env.LOG_LEVEL = 'silent';
  process.env.JWT_ACCESS_SECRET ??= 'e2e-access-secret-0123456789';
  process.env.JWT_REFRESH_SECRET ??= 'e2e-refresh-secret-0123456789';
  process.env.CORS_ORIGINS ??= 'http://localhost:5173,http://localhost:4173';
  process.env.APP_URL ??= 'http://localhost:5173';
  process.env.UPLOAD_DIR ??= './storage/e2e-uploads';

  await runSeed();

  // Imported only now: AppModule validates the environment while it loads.
  const { AppModule } = await import('../app.module');
  const { API_PREFIX, configureApp } = await import('../app.setup');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error'] });

  configureApp(app);
  await app.listen(PORT);

  logger.log(`e2e API em http://localhost:${PORT}/${API_PREFIX}`);

  const stop = async (): Promise<void> => {
    await app.close();
    await mongo.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());
}

void main().catch((error: unknown) => {
  logger.error(
    'Falha ao subir a API de e2e.',
    error instanceof Error ? error.stack : String(error),
  );
  process.exit(1);
});
