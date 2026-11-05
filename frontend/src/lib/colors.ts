/**
 * Cor escolhida pelo usuário (hex, como a API guarda) traduzida para um token da
 * Azuos: nenhuma cor é escrita fora dos tokens, só o tom mais próximo é usado.
 */
export type ColorTone = 'accent' | 'info' | 'success' | 'warning' | 'danger';

const BG_BY_TONE: Record<ColorTone, string> = {
  accent: 'bg-accent',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

function parseHex(color: string): [number, number, number] | null {
  const hex = color.trim().replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((part) => `${part}${part}`)
          .join('')
      : hex;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return null;
  }

  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Matiz em graus (0–360); null quando a cor é cinza ou inválida. */
function hueOf(color: string): number | null {
  const rgb = parseHex(color);

  if (!rgb) {
    return null;
  }

  const [r, g, b] = rgb.map((channel) => channel / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (delta < 0.04) {
    return null;
  }

  let hue: number;

  if (max === r) {
    hue = ((g - b) / delta) % 6;
  } else if (max === g) {
    hue = (b - r) / delta + 2;
  } else {
    hue = (r - g) / delta + 4;
  }

  return (((hue * 60) % 360) + 360) % 360;
}

export function toneFromColor(color: string | undefined): ColorTone {
  const hue = color ? hueOf(color) : null;

  if (hue === null) {
    return 'accent';
  }

  if (hue < 20 || hue >= 340) {
    return 'danger';
  }

  if (hue < 70) {
    return 'warning';
  }

  if (hue < 170) {
    return 'success';
  }

  if (hue < 250) {
    return 'info';
  }

  return 'accent';
}

/** Classe de fundo (token) para o ponto de cor do Space. */
export function colorSwatch(color: string | undefined): string {
  return BG_BY_TONE[toneFromColor(color)];
}
