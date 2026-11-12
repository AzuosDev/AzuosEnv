import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decryptSecret, encryptSecret, encryptionKeyFrom } from '../../common/utils/crypto';

/**
 * Encrypts at rest the secrets the server has to read back in plain: the OAuth
 * tokens of Google and the signing secrets of the webhooks. ENCRYPTION_KEY is the
 * passphrase; without it the key falls back to JWT_ACCESS_SECRET, so development
 * and the tests work without extra configuration.
 */
@Injectable()
export class SecretsService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const configured = (config.get<string>('ENCRYPTION_KEY') ?? '').trim();

    this.key = encryptionKeyFrom(
      configured.length > 0 ? configured : config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    );
  }

  encrypt(plain: string): string {
    return encryptSecret(plain, this.key);
  }

  decrypt(value: string): string {
    return decryptSecret(value, this.key);
  }

  /** null when the stored value cannot be read (rotated key, tampered row). */
  tryDecrypt(value: string | null): string | null {
    if (!value) {
      return null;
    }

    try {
      return this.decrypt(value);
    } catch {
      return null;
    }
  }
}
