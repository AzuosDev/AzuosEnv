import { describe, expect, it } from 'vitest';
import { isChallengeResponse } from './challenge';

function responseWith(status: number, headers: Record<string, string>): Response {
  return new Response('', { status, headers });
}

describe('isChallengeResponse', () => {
  it('reconhece a mitigação da borda pelo cabeçalho', () => {
    expect(isChallengeResponse(responseWith(403, { 'x-vercel-mitigated': 'challenge' }))).toBe(
      true,
    );
  });

  it('reconhece pelo token do desafio', () => {
    expect(isChallengeResponse(responseWith(403, { 'x-vercel-challenge-token': 'abc' }))).toBe(
      true,
    );
  });

  it('reconhece a página HTML do desafio quando o cabeçalho não é legível', () => {
    expect(isChallengeResponse(responseWith(403, { 'content-type': 'text/html' }))).toBe(true);
  });

  it('não confunde com o 403 da nossa API', () => {
    expect(isChallengeResponse(responseWith(403, { 'content-type': 'application/json' }))).toBe(
      false,
    );
  });

  it('não confunde com outros status', () => {
    expect(isChallengeResponse(responseWith(404, { 'content-type': 'text/html' }))).toBe(false);
  });
});
