import { Types } from 'mongoose';
import { isSafeMongoKey, sanitizeMongoInput } from './mongo-sanitize';

describe('sanitizeMongoInput', () => {
  it('drops operator and dotted keys at any depth', () => {
    const input = {
      email: 'a@azuos.dev',
      password: { $ne: null },
      'profile.role': 'owner',
      nested: [{ $where: 'sleep(1)', keep: 1 }],
    };

    expect(sanitizeMongoInput(input)).toEqual({
      email: 'a@azuos.dev',
      password: {},
      nested: [{ keep: 1 }],
    });
  });

  it('keeps values that merely contain $ or .', () => {
    expect(sanitizeMongoInput({ name: 'R$ 10.50', note: '$where' })).toEqual({
      name: 'R$ 10.50',
      note: '$where',
    });
  });

  it('leaves non-plain objects untouched', () => {
    const id = new Types.ObjectId();
    const date = new Date('2026-01-01T00:00:00.000Z');
    const buffer = Buffer.from('x');

    expect(sanitizeMongoInput({ id, date, buffer })).toEqual({ id, date, buffer });
  });

  it('passes scalars through', () => {
    expect(sanitizeMongoInput('x')).toBe('x');
    expect(sanitizeMongoInput(null)).toBeNull();
    expect(sanitizeMongoInput(undefined)).toBeUndefined();
  });

  it('knows which keys are safe', () => {
    expect(isSafeMongoKey('name')).toBe(true);
    expect(isSafeMongoKey('$gt')).toBe(false);
    expect(isSafeMongoKey('a.b')).toBe(false);
  });
});
