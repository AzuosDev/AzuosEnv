import { createHash } from 'node:crypto';

/** Hex sha256, used to store opaque tokens without the plain value. */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
