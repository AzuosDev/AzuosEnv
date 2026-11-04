import { Request } from 'express';
import { ApiKeyPrincipal } from './api-keys.service';

/** Request authenticated by a personal key instead of the access token. */
export interface ApiKeyRequest extends Request {
  apiKey?: ApiKeyPrincipal;
}
