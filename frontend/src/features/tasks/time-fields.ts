/**
 * Minutos em "2h 30min". A API guarda tempo rastreado e estimativa em minutos
 * inteiros; a tela nunca mostra segundos fora do cronômetro em andamento.
 */
export function formatMinutes(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) {
    return '0min';
  }

  const whole = Math.round(minutes);
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;

  if (hours === 0) {
    return `${String(rest)}min`;
  }

  return rest === 0 ? `${String(hours)}h` : `${String(hours)}h ${String(rest)}min`;
}

/** Cronômetro em andamento: hh:mm:ss quando passa de uma hora, mm:ss antes. */
export function formatStopwatch(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  const pad = (value: number): string => String(value).padStart(2, '0');

  return hours > 0
    ? `${String(hours)}:${pad(minutes)}:${pad(rest)}`
    : `${pad(minutes)}:${pad(rest)}`;
}

/** Segundos desde o início do cronômetro; relógio adiantado não vira negativo. */
export function elapsedSeconds(start: string, now = Date.now()): number {
  const began = new Date(start).getTime();

  return Number.isNaN(began) ? 0 : Math.max(0, Math.floor((now - began) / 1000));
}

/**
 * Lê "1h30", "90", "90min", "1:30" ou "1,5h" como minutos. Devolve null quando
 * o texto não tem número nenhum; 0 quando o campo foi limpo de propósito.
 */
export function parseDuration(input: string): number | null {
  const text = input.trim().toLowerCase().replace(',', '.');

  if (text === '') {
    return 0;
  }

  const clock = /^(\d{1,3}):([0-5]?\d)$/.exec(text);

  if (clock) {
    return Number(clock[1]) * 60 + Number(clock[2]);
  }

  const parts = /^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*(?:min|m)?)?$/.exec(text);

  if (!parts || (parts[1] === undefined && parts[2] === undefined)) {
    return null;
  }

  const hours = parts[1] ? Number(parts[1]) : 0;
  const minutes = parts[2] ? Number(parts[2]) : 0;
  const total = Math.round(hours * 60 + minutes);

  return total >= 0 ? total : null;
}

/** Texto do campo de duração a partir dos minutos guardados. */
export function durationInput(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) {
    return '';
  }

  return formatMinutes(minutes).replace(' ', '');
}
