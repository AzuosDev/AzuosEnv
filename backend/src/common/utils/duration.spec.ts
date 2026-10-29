import { durationToMs } from './duration';

describe('durationToMs', () => {
  it('converts every supported unit', () => {
    expect(durationToMs('250ms')).toBe(250);
    expect(durationToMs('15m')).toBe(900_000);
    expect(durationToMs('2h')).toBe(7_200_000);
    expect(durationToMs('30d')).toBe(2_592_000_000);
  });

  it('treats a bare number as seconds', () => {
    expect(durationToMs('900')).toBe(900_000);
  });

  it('rejects invalid durations', () => {
    expect(() => durationToMs('15 weeks')).toThrow();
    expect(() => durationToMs('')).toThrow();
  });
});
