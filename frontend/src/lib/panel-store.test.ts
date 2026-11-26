import { describe, expect, it } from 'vitest';
import {
  clampWidth,
  readPanel,
  widthFromDrag,
  writePanel,
  type PanelLimits,
} from '@/lib/panel-store';

const limits: PanelLimits = { defaultWidth: 280, min: 220, max: 480 };

describe('clampWidth', () => {
  it('prende a largura nos limites e arredonda', () => {
    expect(clampWidth(300.4, limits)).toBe(300);
    expect(clampWidth(10, limits)).toBe(220);
    expect(clampWidth(9999, limits)).toBe(480);
  });

  it('cai no padrão com número inválido', () => {
    expect(clampWidth(Number.NaN, limits)).toBe(280);
  });
});

describe('readPanel', () => {
  it('devolve o padrão sem nada guardado', () => {
    expect(readPanel('nova', limits)).toEqual({ width: 280, collapsed: false });
  });

  it('lê o que foi gravado', () => {
    writePanel('shell-nav', { width: 360, collapsed: true });

    expect(readPanel('shell-nav', limits)).toEqual({ width: 360, collapsed: true });
  });

  it('prende largura fora dos limites e ignora lixo', () => {
    window.localStorage.setItem('azuos-env:panel:x', JSON.stringify({ width: 9999 }));
    expect(readPanel('x', limits)).toEqual({ width: 480, collapsed: false });

    window.localStorage.setItem('azuos-env:panel:y', 'não é json');
    expect(readPanel('y', limits)).toEqual({ width: 280, collapsed: false });
  });
});

describe('widthFromDrag', () => {
  it('arrastar para a direita alarga a barra da esquerda', () => {
    expect(widthFromDrag(280, 40, 'left', limits)).toBe(320);
    expect(widthFromDrag(280, -40, 'left', limits)).toBe(240);
  });

  it('arrastar para a direita estreita a barra da direita', () => {
    expect(widthFromDrag(320, 40, 'right', limits)).toBe(280);
    expect(widthFromDrag(320, -40, 'right', limits)).toBe(360);
  });
});
