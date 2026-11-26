/** Quando o convite de notificação foi adiado, por navegador. */
const KEY = 'azuos-env:push-ask';

/** Adiar não é recusar para sempre: o convite volta depois de duas semanas. */
export const SNOOZE_DAYS = 14;

const DAY = 24 * 60 * 60 * 1000;

/** Marca o adiamento de agora. Modo privativo sem storage não quebra a tela. */
export function snoozePushAsk(now: Date = new Date()): void {
  try {
    window.localStorage.setItem(KEY, String(now.getTime()));
  } catch {
    // Sem localStorage o convite reaparece na próxima visita; é o aceitável.
  }
}

/** O convite ainda está adiado neste navegador. */
export function pushAskSnoozed(now: Date = new Date()): boolean {
  let stored: string | null;

  try {
    stored = window.localStorage.getItem(KEY);
  } catch {
    return false;
  }

  const at = Number(stored);

  if (stored === null || !Number.isFinite(at) || at <= 0) {
    return false;
  }

  // Marca no futuro (relógio adiantado) continua valendo como adiamento.
  return now.getTime() - at < SNOOZE_DAYS * DAY;
}
