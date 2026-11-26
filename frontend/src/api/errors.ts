import { HOST_CHALLENGE, isChallengeResponse } from './challenge';
import type { ApiErrorBody } from './types';

const FALLBACK = 'Não foi possível concluir. Tente de novo.';

const BY_CODE: Record<string, string> = {
  TOO_MANY_REQUESTS: 'Muitas tentativas. Aguarde um minuto e tente de novo.',
  AI_DISABLED: 'A IA está desligada neste workspace. Um admin pode ligar em Configurações.',
  AI_BUDGET_EXCEEDED: 'O orçamento de IA do mês acabou. Fale com um admin para aumentar o limite.',
  AI_RATE_LIMITED: 'Muitos pedidos à IA em pouco tempo. Tente de novo em instantes.',
  WHITEBOARD_VERSION_CONFLICT: 'O quadro mudou em outra aba. Recarregando para aplicar de novo.',
  INTERNAL_ERROR: 'O servidor falhou. Tente de novo em instantes.',
  [HOST_CHALLENGE]:
    'A verificação de segurança do servidor bloqueou a chamada. Recarregue a página; se continuar, desligue o modo de desafio no painel do host.',
};

/** Erro da API já no formato do contrato { statusCode, code, message }. */
export class ApiRequestError extends Error {
  readonly statusCode: number;
  readonly code: string;
  /** Espera pedida pelo servidor no `Retry-After` (ms); nula quando não veio. */
  readonly retryAfterMs: number | null;

  constructor(body: ApiErrorBody, retryAfterMs: number | null = null) {
    super(BY_CODE[body.code] ?? body.message ?? FALLBACK);
    this.name = 'ApiRequestError';
    this.statusCode = body.statusCode;
    this.code = body.code;
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * `Retry-After` em segundos ou como data HTTP. Quem repete a chamada sozinho
 * (a reserva de sincronização) respeita esse prazo em vez do próprio backoff.
 */
export function retryAfterMsOf(response: Response): number | null {
  const header = response.headers.get('Retry-After');

  if (!header) {
    return null;
  }

  const seconds = Number(header);

  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const date = Date.parse(header);

  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

interface ApiResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

function toBody(error: unknown, response: Response): ApiErrorBody {
  if (isChallengeResponse(response)) {
    return { statusCode: response.status, code: HOST_CHALLENGE, message: FALLBACK };
  }

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
    throw new ApiRequestError(
      toBody(result.error, result.response),
      retryAfterMsOf(result.response),
    );
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
