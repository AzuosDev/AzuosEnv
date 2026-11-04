import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { RequestHandler } from 'express';
import helmet from 'helmet';

export const API_PREFIX = 'api/v1';
export const SWAGGER_PATH = 'api/docs';
export const PUBLIC_FORMS_PATH = `/${API_PREFIX}/public/forms`;
const BODY_LIMIT = '1mb';

export interface ConfigureAppOptions {
  /** Mounts Swagger on /api/docs. Disabled in production and in tests. */
  swagger?: boolean;
}

export function configureApp(app: NestExpressApplication, options: ConfigureAppOptions = {}): void {
  const config = app.get(ConfigService);
  const isProduction = config.get<string>('NODE_ENV') === 'production';

  app.set('trust proxy', 1);
  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.use(cookieParser());
  app.useBodyParser('json', { limit: BODY_LIMIT });
  app.useBodyParser('urlencoded', { limit: BODY_LIMIT, extended: true });

  // Runs before the global CORS so the site of Azuos Dev can post a public form.
  app.use(
    PUBLIC_FORMS_PATH,
    publicFormCors(parseCorsOrigins(config.get<string>('PUBLIC_FORM_ORIGINS'))),
  );

  app.enableCors({
    origin: parseCorsOrigins(config.get<string>('CORS_ORIGINS')),
    credentials: true,
  });

  app.enableShutdownHooks();

  if (options.swagger ?? !isProduction) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Azuos Env API')
        .setDescription('API interna da Azuos Dev')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup(SWAGGER_PATH, app, document);
  }
}

/**
 * CORS of the public form routes only: the listed origins may read the form and
 * post a submission. An origin out of the list simply gets no header back.
 */
export function publicFormCors(origins: string[]): RequestHandler {
  return (request, response, next) => {
    const origin = request.headers.origin;

    if (origin && origins.includes(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      response.setHeader('Access-Control-Max-Age', '600');
    }

    if (request.method === 'OPTIONS') {
      response.status(204).end();

      return;
    }

    next();
  };
}

export function parseCorsOrigins(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
