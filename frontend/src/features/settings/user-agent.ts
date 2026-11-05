const BROWSERS: [RegExp, string][] = [
  [/Edg\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Chrome\//, 'Chrome'],
  [/Firefox\//, 'Firefox'],
  [/Safari\//, 'Safari'],
];

const SYSTEMS: [RegExp, string][] = [
  [/Windows/, 'Windows'],
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Linux/, 'Linux'],
];

function match(pairs: [RegExp, string][], value: string): string | null {
  return pairs.find(([pattern]) => pattern.test(value))?.[1] ?? null;
}

/** Nome curto do dispositivo da sessão, a partir do user agent. */
export function deviceLabel(userAgent?: string): string {
  const value = userAgent?.trim();

  if (!value) {
    return 'Dispositivo desconhecido';
  }

  const browser = match(BROWSERS, value);
  const system = match(SYSTEMS, value);

  if (browser && system) {
    return `${browser} no ${system}`;
  }

  return browser ?? system ?? 'Dispositivo desconhecido';
}
