import type { ApiErrorBody } from './types';

const FALLBACK = 'Não foi possível concluir. Tente de novo.';

const BY_CODE: Record<string, string> = {
  TOO_MANY_REQUESTS: 'Muitas tentativas. Aguarde um minuto e tente de novo.',
  INTERNAL_ERROR: 'O servidor falhou. Tente de novo em instantes.',
};

/** Erro da API já no formato do contrato { statusCode, code, message }. */
export class ApiRequestError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(body: ApiErrorBody) {
    super(BY_CODE[body.code] ?? body.message ?? FALLBACK);
    this.name = 'ApiRequestError';
    this.statusCode = body.statusCode;
    this.code = body.code;
  }
}

interface ApiResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

function toBody(error: unknown, response: Response): ApiErrorBody {
  const body = error as Partial<ApiErrorBody> | undefined;

  return {
    statusCode: typeof body?.statusCode === 'number' ? body.statusCode : response.status,
    code: typeof body?.code === 'string' ? body.code : 'HTTP_ERROR',
    message: typeof body?.message === 'string' ? body.message : FALLBACK,
  };
}

/** Devolve o corpo da resposta ou lança ApiRequestError. */
export function unwrap<T>(result: ApiResult<T>): T {
  if (!result.response.ok || result.data === undefined) {
    throw new ApiRequestError(toBody(result.error, result.response));
  }

  return result.data;
}

/** Mensagem pronta para exibir ao usuário, venha de onde vier o erro. */
export function errorMessage(error: unknown, fallback = FALLBACK): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
