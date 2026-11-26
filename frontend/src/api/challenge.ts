/**
 * Desafio de segurança do host (Vercel Firewall em "challenge"): a borda
 * devolve 403 com uma página HTML que só um navegador navegando resolve. Como
 * o Service Worker serve o index do precache, a navegação não chega à borda e
 * o cookie do desafio nunca é criado — aí toda chamada à API volta 403.
 */

/** Código do erro da API quando a resposta é o desafio, não a nossa API. */
export const HOST_CHALLENGE = 'HOST_CHALLENGE';

/** Marca na sessão da aba que a recuperação já foi tentada uma vez. */
const RECOVERY_KEY = 'azuos:host-challenge';

/** A resposta veio da borda do host, não da API. */
export function isChallengeResponse(response: Response): boolean {
  if (response.status !== 403) {
    return false;
  }

  const mitigated = response.headers.get('x-vercel-mitigated');
  const token = response.headers.get('x-vercel-challenge-token');
  const type = response.headers.get('content-type') ?? '';

  return mitigated === 'challenge' || token !== null || type.includes('text/html');
}

let tried = false;

/**
 * Tira o Service Worker do caminho e recarrega uma única vez por aba, para que
 * a navegação chegue à borda e o navegador resolva o desafio. Sem isso o app
 * fica de pé com todas as consultas em erro.
 */
export async function recoverFromChallenge(): Promise<void> {
  if (tried || typeof window === 'undefined') {
    return;
  }

  tried = true;

  try {
    if (window.sessionStorage.getItem(RECOVERY_KEY) !== null) {
      return;
    }

    window.sessionStorage.setItem(RECOVERY_KEY, '1');
  } catch {
    return;
  }

  try {
    const registrations = (await navigator.serviceWorker?.getRegistrations()) ?? [];

    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch {
    // Sem Service Worker a recarga sozinha já resolve.
  }

  window.location.reload();
}
