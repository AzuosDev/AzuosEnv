import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { GoogleLoginError } from './google-login.errors';
import {
  GOOGLE_LOGIN_SCOPES,
  GoogleAuthUrlInput,
  GoogleExchangeInput,
  GoogleIdentity,
  GoogleLoginProvider,
} from './google-login.provider';

/**
 * Real Google: google-auth-library builds the consent URL, exchanges the code with
 * PKCE and verifies the id_token against the client id (audience).
 */
@Injectable()
export class GoogleIdentityProvider implements GoogleLoginProvider {
  constructor(private readonly config: ConfigService) {}

  get available(): boolean {
    return (this.config.get<string>('GOOGLE_CLIENT_ID') ?? '').trim().length > 0;
  }

  authUrl(input: GoogleAuthUrlInput): string {
    return this.client().generateAuthUrl({
      scope: GOOGLE_LOGIN_SCOPES,
      state: input.state,
      code_challenge_method: CodeChallengeMethod.S256,
      code_challenge: input.codeChallenge,
      include_granted_scopes: true,
      prompt: 'select_account',
    });
  }

  async verify(input: GoogleExchangeInput): Promise<GoogleIdentity> {
    const client = this.client();
    const audience = this.config.getOrThrow<string>('GOOGLE_CLIENT_ID');

    const { tokens } = await client.getToken({
      code: input.code,
      codeVerifier: input.codeVerifier,
    });

    if (!tokens.id_token) {
      throw new GoogleLoginError('O Google não devolveu um id_token.');
    }

    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience });
    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email) {
      throw new GoogleLoginError('O id_token do Google não traz a identidade da conta.');
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true,
      name: payload.name,
      picture: payload.picture,
    };
  }

  private client(): OAuth2Client {
    if (!this.available) {
      throw new GoogleLoginError('O login com o Google não está configurado.');
    }

    return new OAuth2Client({
      clientId: this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      redirectUri: this.config.getOrThrow<string>('GOOGLE_LOGIN_REDIRECT_URI'),
    });
  }
}
