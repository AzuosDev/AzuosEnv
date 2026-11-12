import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { UsersService } from '../../users/users.service';
import { UserDocument } from '../../users/schemas/user.schema';
import { InvitesService } from '../../workspaces/invites.service';
import { AuthService } from '../auth.service';
import { RequestContext } from '../refresh-tokens.service';
import { GoogleLoginError } from './google-login.errors';
import {
  GOOGLE_LOGIN_PROVIDER,
  GoogleIdentity,
  GoogleLoginProvider,
} from './google-login.provider';
import {
  GOOGLE_STATE_TTL_SECONDS,
  GoogleCookieClaims,
  GoogleStateClaims,
  safeNextPath,
} from './google-login.state';

export interface GoogleStartInput {
  next?: unknown;
  invite?: unknown;
}

export interface GoogleStart {
  /** Consent URL of Google. */
  url: string;
  /** Signed value of the httpOnly cookie that holds the PKCE verifier. */
  cookie: string;
}

export interface GoogleCallbackInput {
  code?: unknown;
  state?: unknown;
  cookie?: string;
  context: RequestContext;
}

export interface GoogleCallbackResult {
  refreshToken: string;
  /** Relative path the front should open after the session is restored. */
  next?: string;
}

/**
 * Login with Google: `state` (signed, with `next` and `invite`) travels to Google
 * while the PKCE verifier stays in an httpOnly cookie of 10 minutes. The callback
 * only trusts a state whose nonce matches the cookie.
 */
@Injectable()
export class GoogleLoginService {
  private readonly logger = new Logger(GoogleLoginService.name);

  constructor(
    @Inject(GOOGLE_LOGIN_PROVIDER) private readonly provider: GoogleLoginProvider,
    private readonly users: UsersService,
    private readonly auth: AuthService,
    private readonly invites: InvitesService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  get available(): boolean {
    return this.provider.available;
  }

  async start(input: GoogleStartInput): Promise<GoogleStart> {
    if (!this.available) {
      throw new GoogleLoginError('O login com o Google não está configurado.');
    }

    const nonce = randomUUID();
    const verifier = randomBytes(32).toString('base64url');
    const state = await this.sign<GoogleStateClaims>({
      nonce,
      next: safeNextPath(input.next),
      invite: typeof input.invite === 'string' ? input.invite.slice(0, 128) : undefined,
    });

    return {
      url: this.provider.authUrl({
        state,
        codeChallenge: createHash('sha256').update(verifier).digest('base64url'),
      }),
      cookie: await this.sign<GoogleCookieClaims>({ nonce, verifier }),
    };
  }

  /** Validates the state, exchanges the code and opens the session of the user. */
  async callback(input: GoogleCallbackInput): Promise<GoogleCallbackResult> {
    if (!this.available) {
      throw new GoogleLoginError('O login com o Google não está configurado.');
    }

    if (typeof input.code !== 'string' || input.code.length === 0) {
      throw new GoogleLoginError('O Google não devolveu o código de autorização.');
    }

    const state = await this.verifyToken<GoogleStateClaims>(input.state);
    const cookie = await this.verifyToken<GoogleCookieClaims>(input.cookie);

    if (!state.nonce || state.nonce !== cookie.nonce || !cookie.verifier) {
      throw new GoogleLoginError('O state do login com o Google é inválido.');
    }

    const identity = await this.provider.verify({
      code: input.code,
      codeVerifier: cookie.verifier,
    });

    if (!identity.emailVerified) {
      throw new GoogleLoginError('O e-mail da conta do Google não está verificado.');
    }

    const user = await this.resolveUser(identity);
    const session = await this.auth.issueSession(user, input.context);

    if (state.invite) {
      await this.acceptInvite(state.invite, user);
    }

    return { refreshToken: session.refreshToken, next: safeNextPath(state.next) };
  }

  /** URL the callback sends the browser to once the session cookie is set. */
  successUrl(next?: string): string {
    const url = `${this.frontendUrl()}/auth/callback`;
    const path = safeNextPath(next);

    return path ? `${url}?next=${encodeURIComponent(path)}` : url;
  }

  errorUrl(): string {
    return `${this.frontendUrl()}/login?erro=google`;
  }

  /** Existing link, then the e-mail, then a new account. */
  private async resolveUser(identity: GoogleIdentity): Promise<UserDocument> {
    const linked = await this.users.findByGoogleId(identity.googleId);

    if (linked) {
      return linked;
    }

    const email = identity.email.trim().toLowerCase();
    const existing = await this.users.findByEmail(email);

    if (existing) {
      return this.users.linkGoogle(existing, identity.googleId, identity.picture);
    }

    return this.users.createFromGoogle({
      name: identity.name?.trim() || email,
      email,
      googleId: identity.googleId,
      avatarUrl: identity.picture,
    });
  }

  /** An invite that cannot be accepted must not cost the user the login. */
  private async acceptInvite(token: string, user: UserDocument): Promise<void> {
    try {
      await this.invites.acceptForUser(token, user._id, user.email);
    } catch (error) {
      this.logger.warn(
        `Convite não aceito no login com o Google: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private sign<T extends object>(claims: T): Promise<string> {
    return this.jwt.signAsync(claims, { expiresIn: GOOGLE_STATE_TTL_SECONDS });
  }

  private async verifyToken<T extends object>(token: unknown): Promise<T> {
    if (typeof token !== 'string' || token.length === 0) {
      throw new GoogleLoginError('O state do login com o Google é inválido.');
    }

    try {
      return await this.jwt.verifyAsync<T>(token);
    } catch {
      throw new GoogleLoginError('O state do login com o Google é inválido.');
    }
  }

  private frontendUrl(): string {
    return (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173').replace(/\/+$/, '');
  }
}
