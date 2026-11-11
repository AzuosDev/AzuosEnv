import type { Request, RequestHandler, Response } from 'express';
import { parseCorsOrigins, publicFormCors } from './app.setup';

interface FakeResponse {
  headers: Record<string, string>;
  statusCode: number | null;
  ended: boolean;
}

function run(
  middleware: RequestHandler,
  method: string,
  origin?: string,
): { response: FakeResponse; nextCalled: boolean } {
  const response: FakeResponse = { headers: {}, statusCode: null, ended: false };
  let nextCalled = false;

  const fake = {
    setHeader: (name: string, value: string) => {
      response.headers[name] = value;
    },
    status: (code: number) => {
      response.statusCode = code;

      return { end: () => void (response.ended = true) };
    },
  } as unknown as Response;

  middleware({ method, headers: origin ? { origin } : {} } as Request, fake, () => {
    nextCalled = true;
  });

  return { response, nextCalled };
}

describe('parseCorsOrigins', () => {
  it('quebra a lista e descarta o vazio', () => {
    expect(parseCorsOrigins(' http://a , ,http://b ')).toEqual(['http://a', 'http://b']);
    expect(parseCorsOrigins(undefined)).toEqual([]);
  });
});

describe('publicFormCors', () => {
  const middleware = publicFormCors(['https://azuos.dev']);

  it('libera a origem da lista', () => {
    const { response, nextCalled } = run(middleware, 'GET', 'https://azuos.dev');

    expect(response.headers['Access-Control-Allow-Origin']).toBe('https://azuos.dev');
    expect(nextCalled).toBe(true);
  });

  it('responde o preflight da origem liberada', () => {
    const { response, nextCalled } = run(middleware, 'OPTIONS', 'https://azuos.dev');

    expect(response.statusCode).toBe(204);
    expect(response.ended).toBe(true);
    expect(nextCalled).toBe(false);
  });

  /** Sem isso o preflight do próprio app morria aqui, antes do CORS global. */
  it('deixa o preflight de outra origem seguir para o CORS global', () => {
    const { response, nextCalled } = run(middleware, 'OPTIONS', 'http://localhost:5173');

    expect(response.statusCode).toBeNull();
    expect(nextCalled).toBe(true);
  });
});
