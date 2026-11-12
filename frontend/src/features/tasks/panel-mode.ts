/** Como o painel da tarefa aparece a partir de 1024 px. */
export const PANEL_MODES = ['side', 'modal', 'full'] as const;

export type PanelMode = (typeof PANEL_MODES)[number];

export const PANEL_MODE_LABEL: Record<PanelMode, string> = {
  side: 'Painel lateral',
  modal: 'Modal',
  full: 'Tela cheia',
};

export const MIN_PANEL_WIDTH = 360;
export const MAX_PANEL_WIDTH = 920;
export const DEFAULT_PANEL_WIDTH = 480;

const MODE_STORAGE_KEY = 'azuos-env:task-panel:mode';
const WIDTH_STORAGE_KEY = 'azuos-env:task-panel:width';

export function isPanelMode(value: unknown): value is PanelMode {
  return typeof value === 'string' && (PANEL_MODES as readonly string[]).includes(value);
}

/** A largura fica entre o mínimo e o máximo e nunca passa de 80% da janela. */
export function clampPanelWidth(width: number, viewport = MAX_PANEL_WIDTH * 2): number {
  const ceiling = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, Math.round(viewport * 0.8)));

  if (!Number.isFinite(width)) {
    return DEFAULT_PANEL_WIDTH;
  }

  return Math.min(ceiling, Math.max(MIN_PANEL_WIDTH, Math.round(width)));
}

/** localStorage pode estar bloqueado: toda leitura e escrita volta no padrão. */
export function readPanelMode(): PanelMode {
  try {
    const stored = window.localStorage.getItem(MODE_STORAGE_KEY);

    return isPanelMode(stored) ? stored : 'side';
  } catch {
    return 'side';
  }
}

export function writePanelMode(mode: PanelMode): void {
  try {
    window.localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // Sem armazenamento o modo vale só nesta sessão.
  }
}

export function readPanelWidth(): number {
  try {
    const stored = Number(window.localStorage.getItem(WIDTH_STORAGE_KEY));

    return stored > 0 ? clampPanelWidth(stored, window.innerWidth) : DEFAULT_PANEL_WIDTH;
  } catch {
    return DEFAULT_PANEL_WIDTH;
  }
}

export function writePanelWidth(width: number): void {
  try {
    window.localStorage.setItem(WIDTH_STORAGE_KEY, String(width));
  } catch {
    // Idem: a largura vale só nesta sessão.
  }
}
