/** Largura e visibilidade das barras laterais, guardadas no localStorage. */
const PREFIX = 'azuos-env:panel:';

export interface PanelState {
  /** Largura em px quando a barra está visível. */
  width: number;
  collapsed: boolean;
}

export interface PanelLimits {
  defaultWidth: number;
  min: number;
  max: number;
}

export type PanelSide = 'left' | 'right';

function storageKey(id: string): string {
  return `${PREFIX}${id}`;
}

/** Arredonda e prende a largura nos limites do painel. */
export function clampWidth(width: number, limits: PanelLimits): number {
  if (!Number.isFinite(width)) {
    return limits.defaultWidth;
  }

  return Math.round(Math.min(Math.max(width, limits.min), limits.max));
}

export function readPanel(id: string, limits: PanelLimits): PanelState {
  const fallback: PanelState = { width: limits.defaultWidth, collapsed: false };

  try {
    const raw = window.localStorage.getItem(storageKey(id));
    const parsed: unknown = raw ? JSON.parse(raw) : null;

    if (parsed === null || typeof parsed !== 'object') {
      return fallback;
    }

    const record = parsed as Record<string, unknown>;
    const width = typeof record.width === 'number' ? record.width : limits.defaultWidth;

    return { width: clampWidth(width, limits), collapsed: record.collapsed === true };
  } catch {
    return fallback;
  }
}

export function writePanel(id: string, state: PanelState): void {
  try {
    window.localStorage.setItem(storageKey(id), JSON.stringify(state));
  } catch {
    // Sem localStorage (janela privada), a barra só perde a memória.
  }
}

/**
 * Largura durante o arraste: puxar para a direita alarga a barra da esquerda e
 * estreita a da direita.
 */
export function widthFromDrag(
  startWidth: number,
  deltaX: number,
  side: PanelSide,
  limits: PanelLimits,
): number {
  return clampWidth(startWidth + (side === 'left' ? deltaX : -deltaX), limits);
}
