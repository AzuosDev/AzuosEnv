/** Keys whose value is never sent to the model. */
const SECRET_KEY =
  /(senha|password|passwd|secret|segredo|token|api[_-]?key|apikey|authorization|credential|private[_-]?key|hash)/i;

/** `chave: valor`, `chave=valor` and `"chave": "valor"` of a secret-looking key. */
const SECRET_ASSIGNMENT =
  /(["']?[\w.-]*(?:senha|password|passwd|secret|segredo|token|api[_-]?key|apikey|authorization|credential|private[_-]?key|hash)[\w.-]*["']?\s*[:=]\s*)(["']?)([^\s"',;}]+)\2/gi;

const BEARER = /\b(Bearer)\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const PREFIXED_KEY = /\b(?:sk|xai|gh[pousr]|AKIA|glpat)[-_][A-Za-z0-9_-]{16,}\b/g;
const LONG_HEX = /\b[A-Fa-f0-9]{40,}\b/g;

export const REDACTED = '[redigido]';

/**
 * Removes passwords, tokens and secrets from any text before it leaves for the
 * model. Narrow on purpose: it only touches assignments of secret-looking keys and
 * strings shaped like a credential, so ordinary prose survives untouched.
 */
export function redactSecrets(text: string): string {
  // The credential shapes go first: `Authorization: Bearer x` would otherwise lose
  // only the scheme to the assignment rule and keep the token.
  return text
    .replace(BEARER, (_match, scheme: string) => `${scheme} ${REDACTED}`)
    .replace(JWT, REDACTED)
    .replace(PREFIXED_KEY, REDACTED)
    .replace(LONG_HEX, REDACTED)
    .replace(SECRET_ASSIGNMENT, (_match, prefix: string) => `${prefix}${REDACTED}`);
}

/** Same guarantee over a structure: a secret-looking key loses its whole value. */
export function redactValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return redactSecrets(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        SECRET_KEY.test(key) ? REDACTED : redactValue(item),
      ]),
    );
  }

  return value;
}

/** Keeps the context inside the window; the cut is always marked. */
export function truncate(text: string, max: number): string {
  const clean = text.trim();

  return clean.length <= max ? clean : `${clean.slice(0, max)} […]`;
}

/** Text of an entity, already redacted and truncated, ready for the prompt. */
export function contextText(text: string, max: number): string {
  return truncate(redactSecrets(text), max);
}
