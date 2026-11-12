import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorResponseBody {
  statusCode: number;
  code: string;
  message: string;
}

const DEFAULT_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
};

const DEFAULT_MESSAGES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Requisição inválida.',
  [HttpStatus.UNAUTHORIZED]: 'Não autenticado.',
  [HttpStatus.FORBIDDEN]: 'Acesso negado.',
  [HttpStatus.NOT_FOUND]: 'Recurso não encontrado.',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Muitas requisições. Tente novamente em instantes.',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Erro interno do servidor.',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body = this.buildBody(exception);

    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${body.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(body.statusCode).json(body);
  }

  private buildBody(exception: unknown): ErrorResponseBody {
    if (!(exception instanceof HttpException)) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_ERROR',
        message: DEFAULT_MESSAGES[HttpStatus.INTERNAL_SERVER_ERROR],
      };
    }

    const statusCode = exception.getStatus();
    const fallbackCode = DEFAULT_CODES[statusCode] ?? 'HTTP_ERROR';
    const fallbackMessage = DEFAULT_MESSAGES[statusCode] ?? exception.message;
    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return { statusCode, code: fallbackCode, message: payload };
    }

    const record = payload as Record<string, unknown>;
    const rawMessage = record.message;
    let message = fallbackMessage;

    if (typeof rawMessage === 'string') {
      message = rawMessage;
    } else if (Array.isArray(rawMessage)) {
      message = rawMessage.map((item) => String(item)).join('; ');
    }

    return {
      statusCode,
      code: typeof record.code === 'string' ? record.code : fallbackCode,
      message,
    };
  }
}
