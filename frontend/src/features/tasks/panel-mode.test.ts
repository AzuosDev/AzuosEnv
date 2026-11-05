import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PANEL_WIDTH,
  MAX_PANEL_WIDTH,
  MIN_PANEL_WIDTH,
  clampPanelWidth,
  isPanelMode,
} from './panel-mode';

describe('isPanelMode', () => {
  it('só aceita os três modos do painel', () => {
    expect(isPanelMode('side')).toBe(true);
    expect(isPanelMode('modal')).toBe(true);
    expect(isPanelMode('full')).toBe(true);
    expect(isPanelMode('gaveta')).toBe(false);
    expect(isPanelMode(null)).toBe(false);
  });
});

describe('clampPanelWidth', () => {
  it('respeita o mínimo, o máximo e 80% da janela', () => {
    expect(clampPanelWidth(10, 1920)).toBe(MIN_PANEL_WIDTH);
    expect(clampPanelWidth(5000, 1920)).toBe(MAX_PANEL_WIDTH);
    expect(clampPanelWidth(600, 1024)).toBe(600);
    expect(clampPanelWidth(900, 1024)).toBe(819);
    expect(clampPanelWidth(Number.NaN, 1920)).toBe(DEFAULT_PANEL_WIDTH);
  });

  it('nunca desce abaixo do mínimo mesmo em janela estreita', () => {
    expect(clampPanelWidth(400, 400)).toBe(MIN_PANEL_WIDTH);
  });
});
