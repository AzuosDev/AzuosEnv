import { PASSWORD_PATTERN } from './password.rule';

describe('PASSWORD_PATTERN', () => {
  it('accepts at least 8 characters with a letter and a number', () => {
    expect(PASSWORD_PATTERN.test('Azuos2026')).toBe(true);
    expect(PASSWORD_PATTERN.test('abcdefg1')).toBe(true);
  });

  it('rejects short passwords and passwords without a letter or a number', () => {
    expect(PASSWORD_PATTERN.test('Azuos20')).toBe(false);
    expect(PASSWORD_PATTERN.test('semnumeros')).toBe(false);
    expect(PASSWORD_PATTERN.test('12345678')).toBe(false);
  });
});
