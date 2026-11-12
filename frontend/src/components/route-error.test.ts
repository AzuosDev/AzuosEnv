import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '@/api/errors';
import { routeErrorKind } from './route-error';

afterEach(() => {
  vi.restoreAllMocks();
});

function apiError(statusCode: number, code = 'ERRO') {
  return new ApiRequestError({ statusCode, code, message: 'falhou' });
}

describe('routeErrorKind', () => {
  it('401 e 403 viram tela de sessão expirada', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

    expect(routeErrorKind(apiError(401, 'UNAUTHORIZED'))).toBe('session');
    expect(routeErrorKind(apiError(403, 'FORBIDDEN'))).toBe('session');
  });

  it('falha de rede vira tela de sem conexão', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    expect(routeErrorKind(new Error('Failed to fetch'))).toBe('offline');
  });

  it('o resto cai na tela genérica com "Tentar de novo"', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

    expect(routeErrorKind(apiError(500, 'INTERNAL_ERROR'))).toBe('unexpected');
    expect(routeErrorKind(new Error('boom'))).toBe('unexpected');
  });
});
