import { describe, expect, it } from 'vitest';
import { colorSwatch, toneFromColor } from './colors';

describe('toneFromColor', () => {
  it('mapeia a cor escolhida para o token mais próximo', () => {
    expect(toneFromColor('#A78BFA')).toBe('accent');
    expect(toneFromColor('#2563EB')).toBe('info');
    expect(toneFromColor('#22C55E')).toBe('success');
    expect(toneFromColor('#F59E0B')).toBe('warning');
    expect(toneFromColor('#EF4444')).toBe('danger');
  });

  it('aceita hex curto e sem #', () => {
    expect(toneFromColor('#0f0')).toBe('success');
    expect(toneFromColor('ef4444')).toBe('danger');
  });

  it('cinza, vazio e lixo caem no accent', () => {
    expect(toneFromColor('#808080')).toBe('accent');
    expect(toneFromColor(undefined)).toBe('accent');
    expect(toneFromColor('azul')).toBe('accent');
  });
});

describe('colorSwatch', () => {
  it('devolve a classe do token', () => {
    expect(colorSwatch('#22C55E')).toBe('bg-success');
    expect(colorSwatch(undefined)).toBe('bg-accent');
  });
});
