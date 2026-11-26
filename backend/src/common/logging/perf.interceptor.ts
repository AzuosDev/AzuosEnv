import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { Observable, tap } from 'rxjs';

/**
 * Mede o custo de cada requisição: duração de parede e CPU (user + system) do
 * processo entre a entrada e a saída do handler.
 *
 * Em serverless a CPU é o que a Vercel cobra (Active CPU), então é ela — e não o
 * tempo total — que diz qual rota é cara. Com requisições concorrentes na mesma
 * instância as medidas se sobrepõem; o volume aqui é baixo, então serve.
 *
 * Linha: { context: 'Perf', method, route, status, ms, cpuMs }. Desligue com
 * PERF_LOG=false.
 */
@Injectable()
export class PerfInterceptor implements NestInterceptor {
  private readonly enabled: boolean;

  constructor(
    private readonly logger: PinoLogger,
    config: ConfigService,
  ) {
    this.enabled =
      config.get<string>('NODE_ENV') !== 'test' && config.get<string>('PERF_LOG') !== 'false';
    this.logger.setContext('Perf');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.enabled || context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const startCpu = process.cpuUsage();
    const startedAt = process.hrtime.bigint();
    const log = () => {
      const cpu = process.cpuUsage(startCpu);

      this.logger.info({
        method: request.method,
        route: routeOf(request),
        status: http.getResponse<Response>().statusCode,
        ms: Number(process.hrtime.bigint() - startedAt) / 1e6,
        cpuMs: (cpu.user + cpu.system) / 1000,
      });
    };

    return next.handle().pipe(tap({ next: log, error: log }));
  }
}

/** Caminho com os parâmetros ainda como `:id`, para agrupar as linhas por rota. */
function routeOf(request: Request): string {
  const route = (request.route as { path?: string } | undefined)?.path;

  return route ? `${request.baseUrl}${route}` : request.originalUrl.split('?')[0];
}
