const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

const DURATION_PATTERN = /^(\d+)(ms|s|m|h|d)?$/;

/**
 * Converts a duration such as `15m`, `30d` or `900` (seconds) into milliseconds.
 */
export function durationToMs(value: string): number {
  const match = DURATION_PATTERN.exec(value.trim());

  if (!match) {
    throw new Error(`Duração inválida: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2] ?? 's';

  return amount * UNIT_MS[unit];
}
