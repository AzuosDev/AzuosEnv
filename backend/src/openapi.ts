import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AppModule } from './app.module';
import { API_PREFIX } from './app.setup';

/**
 * Writes docs/openapi.json, the contract the front is built against, and refuses to
 * write a document whose operations do not describe the response they return.
 *
 * The application only boots to be read, so the database is an in-memory one and no
 * real environment is touched.
 */
const OUTPUT = resolve(__dirname, '..', '..', 'docs', 'openapi.json');

const logger = new Logger('OpenAPI');

interface Operation {
  operationId?: string;
  responses?: Record<string, { content?: Record<string, { schema?: unknown }> }>;
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

async function generate(): Promise<void> {
  const mongod = await MongoMemoryServer.create();

  process.env.MONGODB_URI = mongod.getUri('azuos-env-openapi');
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'development';
  process.env.LOG_LEVEL = 'silent';
  process.env.JWT_ACCESS_SECRET ??= 'openapi-access-secret-value';
  process.env.JWT_REFRESH_SECRET ??= 'openapi-refresh-secret-value';

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.setGlobalPrefix(API_PREFIX);

  try {
    await app.init();

    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Azuos Env API')
        .setDescription(
          'API interna da Azuos Dev. Toda resposta de documento também traz id, ' +
            'createdAt e updatedAt; as datas são UTC ISO 8601 e as listas paginadas ' +
            'respondem { items, nextCursor }.',
        )
        .setVersion('1.0')
        .addBearerAuth()
        .addServer(`/${API_PREFIX}`)
        .build(),
    );

    normalizeObjectId(document.components?.schemas);

    const { operations, undocumented, schemaless } = review(
      document.paths as unknown as Record<string, Record<string, unknown>>,
    );

    if (undocumented.length > 0) {
      throw new Error(
        `Endpoints sem resposta documentada no Swagger:\n- ${undocumented.join('\n- ')}`,
      );
    }

    await mkdir(dirname(OUTPUT), { recursive: true });
    await writeFile(OUTPUT, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

    logger.log(`${operations} endpoints em ${OUTPUT}`);
    logger.log(
      `${operations - schemaless.length}/${operations} com schema de resposta no contrato.`,
    );
  } finally {
    await app.close();
    await mongod.stop();
  }
}

/** Mongoose ids reach the front as the 24 hex characters of the ObjectId. */
function normalizeObjectId(schemas: Record<string, unknown> | undefined): void {
  if (schemas?.ObjectId) {
    schemas.ObjectId = {
      type: 'string',
      pattern: '^[0-9a-fA-F]{24}$',
      description: 'ObjectId em 24 caracteres hexadecimais.',
    };
  }
}

/** Every operation of the document, split by how well its response is described. */
export function review(paths: Record<string, Record<string, unknown>>): {
  operations: number;
  undocumented: string[];
  schemaless: string[];
} {
  let operations = 0;
  const undocumented: string[] = [];
  const schemaless: string[] = [];

  for (const [path, item] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      const operation = item[method] as Operation | undefined;

      if (!operation) {
        continue;
      }

      operations += 1;

      const responses = Object.entries(operation.responses ?? {}).filter(([status]) =>
        status.startsWith('2'),
      );
      const route = `${method.toUpperCase()} ${path}`;

      if (responses.length === 0) {
        undocumented.push(route);

        continue;
      }

      const described = responses.some(([, response]) =>
        Object.values(response.content ?? {}).some((media) => media.schema !== undefined),
      );

      if (!described) {
        schemaless.push(route);
      }
    }
  }

  return { operations, undocumented, schemaless };
}

void generate().catch((error: unknown) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
