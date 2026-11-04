import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IncomingMessage, ServerResponse } from 'node:http';
import { LoggerModule } from 'nestjs-pino';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Structured logging with nestjs-pino. Every line carries the requestId (the header
 * of the client, when it sends one, otherwise a uuid), which also goes back in the
 * response so a report from the front can be matched to the log of the backend.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const environment = config.get<string>('NODE_ENV') ?? 'development';

        return {
          pinoHttp: {
            level: environment === 'test' ? 'silent' : (config.get<string>('LOG_LEVEL') ?? 'info'),
            genReqId: (request: IncomingMessage, response: ServerResponse) => {
              const header = request.headers[REQUEST_ID_HEADER];
              const id = (Array.isArray(header) ? header[0] : header) ?? randomUUID();

              response.setHeader(REQUEST_ID_HEADER, id);

              return id;
            },
            customProps: () => ({ context: 'HTTP' }),
            // Nothing that identifies a session or a secret reaches the log.
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.headers["x-hub-signature-256"]',
                'res.headers["set-cookie"]',
              ],
              censor: '[redacted]',
            },
            autoLogging: { ignore: (request) => request.url === '/api/v1/health' },
          },
        };
      },
    }),
  ],
})
export class AppLoggerModule {}
