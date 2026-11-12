import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleLoginError } from './google-login.errors';
import {
  GoogleAuthUrlInput,
  GoogleExchangeInput,
  GoogleIdentity,
  GoogleLoginProvider,
} from './google-login.provider';

/** Identity the mock answers with when the code carries none. */
export const DEFAULT_MOCK_IDENTITY: GoogleIdentity = {
  googleId: 'mock-google-sub',
  email: 'google.mock@azuos.dev',
  emailVerified: true,
  name: 'Conta Google',
  picture: 'https://example.test/avatar.png',
};

const PREFIX = 'mock.';

/** Code that makes the mock answer with this identity; used by the e2e of the front. */
export function encodeMockGoogleCode(identity: Partial<GoogleIdentity>): string {
  return PREFIX + Buffer.from(JSON.stringify(identity), 'utf8').toString('base64url');
}

/**
 * Fake Google for development and for the tests: the consent URL points straight
 * back to the callback, so the browser never leaves the app. Enabled only by
 * GOOGLE_MOCK outside production.
 */
@Injectable()
export class MockGoogleLoginProvider implements GoogleLoginProvider {
  constructor(private readonly config: ConfigService) {}

  readonly available = true;

  authUrl(input: GoogleAuthUrlInput): string {
    const url = new URL(this.config.getOrThrow<string>('GOOGLE_LOGIN_REDIRECT_URI'));

    url.searchParams.set('code', encodeMockGoogleCode(DEFAULT_MOCK_IDENTITY));
    url.searchParams.set('state', input.state);

    return url.toString();
  }

  verify(input: GoogleExchangeInput): Promise<GoogleIdentity> {
    if (!input.code.startsWith(PREFIX)) {
      throw new GoogleLoginError('Código do Google inválido.');
    }

    try {
      const decoded = JSON.parse(
        Buffer.from(input.code.slice(PREFIX.length), 'base64url').toString('utf8'),
      ) as Partial<GoogleIdentity>;

      return Promise.resolve({ ...DEFAULT_MOCK_IDENTITY, ...decoded });
    } catch {
      throw new GoogleLoginError('Código do Google inválido.');
    }
  }
}
