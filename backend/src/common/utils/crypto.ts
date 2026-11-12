import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const FORMAT = 'v1';

/**
 * 32-byte key derived from the configured passphrase, so ENCRYPTION_KEY may be any
 * string instead of exactly 32 bytes.
 */
export function encryptionKeyFrom(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

/** `v1:<iv>:<tag>:<ciphertext>`, every part base64url. */
export function encryptSecret(plain: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const payload = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);

  return [
    FORMAT,
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    payload.toString('base64url'),
  ].join(':');
}

/** Reverses `encryptSecret`; throws when the value was tampered with or truncated. */
export function decryptSecret(value: string, key: Buffer): string {
  const parts = value.split(':');

  if (parts.length !== 4 || parts[0] !== FORMAT) {
    throw new Error('Formato de segredo inválido.');
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(parts[1], 'base64url'));
  decipher.setAuthTag(Buffer.from(parts[2], 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(parts[3], 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/** Constant-time comparison of two signatures of the same length. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');

  return left.length === right.length && timingSafeEqual(left, right);
}
