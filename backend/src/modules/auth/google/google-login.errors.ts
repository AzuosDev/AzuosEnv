/** Any failure of the Google login; the controller turns it into the error redirect. */
export class GoogleLoginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleLoginError';
  }
}
