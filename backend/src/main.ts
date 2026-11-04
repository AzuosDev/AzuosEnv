import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { API_PREFIX, configureApp } from './app.setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  configureApp(app);

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT') ?? 3000;

  await app.listen(port);
  app.get(Logger).log(`Azuos Env API em http://localhost:${port}/${API_PREFIX}`);
}

void bootstrap();
