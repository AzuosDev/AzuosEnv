import { slugify } from './slug';

describe('slugify', () => {
  it('removes accents and normalizes separators', () => {
    expect(slugify('Azuos Dev — Operações')).toBe('azuos-dev-operacoes');
  });

  it('trims hyphens and falls back when nothing is left', () => {
    expect(slugify('  --Time #1--  ')).toBe('time-1');
    expect(slugify('***')).toBe('workspace');
  });

  it('limits the length', () => {
    expect(slugify('a'.repeat(80))).toHaveLength(48);
  });
});
