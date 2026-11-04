/** What a personal key may do; `read` never writes. */
export const API_KEY_SCOPES = ['read', 'write'] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

/** Every key is handed over with this prefix, so a leak is easy to recognise. */
export const API_KEY_PREFIX = 'azk_';

/** Random bytes of the secret part of the key. */
export const API_KEY_BYTES = 32;

/** Characters kept in plain to identify the key in the listing. */
export const API_KEY_HINT_LENGTH = API_KEY_PREFIX.length + 8;

export const MAX_API_KEY_NAME_LENGTH = 120;

/** Keys one user may keep active at the same time. */
export const MAX_API_KEYS_PER_USER = 20;

/** HTTP methods a `read` key is allowed to call. */
export const READ_ONLY_METHODS = ['GET', 'HEAD', 'OPTIONS'] as const;

export function isReadOnlyMethod(method: string): boolean {
  return (READ_ONLY_METHODS as readonly string[]).includes(method.toUpperCase());
}
