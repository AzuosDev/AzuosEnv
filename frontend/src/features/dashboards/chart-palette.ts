/** Tokens que podem pintar série de gráfico; nenhuma cor fora daqui. */
export const CHART_TOKENS = ['accent', 'info', 'success', 'warning', 'danger', 'signal'] as const;
export type ChartToken = (typeof CHART_TOKENS)[number];

export interface ChartPalette {
  /** Cores das séries, na ordem em que entram no gráfico. */
  series: string[];
  axis: string;
  grid: string;
  ink: string;
  muted: string;
  surface: string;
  line: string;
}

/** "167 139 250" vira "rgb(167 139 250)"; token vazio cai no cinza do texto. */
export function tokenRgb(value: string, fallback = 'rgb(128 128 128)'): string {
  const triplet = value.trim();

  return /^\d+\s+\d+\s+\d+$/.test(triplet) ? `rgb(${triplet})` : fallback;
}

/**
 * Paleta do gráfico lida dos tokens do tema. O recharts escreve as cores em
 * atributo do SVG, onde `var(--token)` não é resolvido, então o valor precisa
 * virar rgb() de verdade — e ser lido de novo quando o tema muda.
 */
export function paletteFrom(read: (token: string) => string): ChartPalette {
  return {
    series: CHART_TOKENS.map((token) => tokenRgb(read(`--${token}`))),
    axis: tokenRgb(read('--muted')),
    grid: tokenRgb(read('--line')),
    ink: tokenRgb(read('--ink')),
    muted: tokenRgb(read('--muted')),
    surface: tokenRgb(read('--surface')),
    line: tokenRgb(read('--line')),
  };
}

/** Cor da série pelo índice; acima do fim da paleta ela recomeça. */
export function seriesColor(palette: ChartPalette, index: number): string {
  const colors = palette.series;

  return colors[index % colors.length] ?? palette.muted;
}
