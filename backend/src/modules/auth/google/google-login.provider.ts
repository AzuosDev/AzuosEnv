/** Identity of the Google account, as the verified id_token describes it. */
export interface GoogleIdentity {
  /** `sub` of the id_token: stable id of the Google account. */
  googleId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

export interface GoogleAuthUrlInput {
  state: string;
  codeChallenge: string;
}

export interface GoogleExchangeInput {
  code: string;
  codeVerifier: string;
}

/** What the login needs from Google; the mock of the tests implements the same. */
export interface GoogleLoginProvider {
  /** False when the server has no OAuth client configured. */
  readonly available: boolean;
  authUrl(input: GoogleAuthUrlInput): string;
  verify(input: GoogleExchangeInput): Promise<GoogleIdentity>;
}

export const GOOGLE_LOGIN_PROVIDER = Symbol('GOOGLE_LOGIN_PROVIDER');

export const GOOGLE_LOGIN_SCOPES = ['openid', 'email', 'profile'];
