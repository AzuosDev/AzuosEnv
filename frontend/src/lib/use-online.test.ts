import { afterEach, describe, expect, it, vi } from 'vitest';
import { isNetworkError } from './use-online';

function setOnline(value: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isNetworkError', () => {
  it('é verdadeiro com o navegador offline, qualquer que seja o erro', () => {
    setOnline(false);

    expect(isNetworkError(new Error('qualquer coisa'))).toBe(true);
  });

  it('reconhece o fetch que nem saiu', () => {
    setOnline(true);

    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkError(new TypeError('NetworkError when attempting to fetch'))).toBe(true);
  });

  it('não confunde erro da aplicação com queda de rede', () => {
    setOnline(true);

    expect(isNetworkError(new Error('Tarefa não encontrada'))).toBe(false);
    expect(isNetworkError('falhou')).toBe(false);
  });
});
