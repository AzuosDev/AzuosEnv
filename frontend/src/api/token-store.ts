/**
 * Access token da sessão. Fica só em memória: nada de localStorage, porque a
 * renovação vem do cookie httpOnly de refresh.
 */
let accessToken: string | null = null;
let sessionLost: (() => void) | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Registra quem reage à perda da sessão (limpar o cache e ir para /login). */
export function onSessionLost(handler: (() => void) | null): void {
  sessionLost = handler;
}

export function notifySessionLost(): void {
  sessionLost?.();
}
