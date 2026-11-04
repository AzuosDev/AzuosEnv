import { describe, expect, it } from 'vitest';
import { suggestTaskPrefix } from './prefix';

describe('suggestTaskPrefix', () => {
  it('usa as iniciais das palavras', () => {
    expect(suggestTaskPrefix('Azuos Dev')).toBe('AD');
    expect(suggestTaskPrefix('Azuos Dev Sistemas')).toBe('ADS');
  });

  it('com uma palavra só usa as primeiras letras', () => {
    expect(suggestTaskPrefix('azuos')).toBe('AZU');
  });

  it('descarta acentuação, pontuação e espaços sobrando', () => {
    expect(suggestTaskPrefix('  Automação & Resultados  ')).toBe('AR');
    expect(suggestTaskPrefix('...')).toBe('');
    expect(suggestTaskPrefix('')).toBe('');
  });

  it('nunca passa de 6 caracteres', () => {
    expect(suggestTaskPrefix('a b c d e f g h')).toBe('ABCDEF');
  });
});
