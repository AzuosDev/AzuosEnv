import { MAX_WA_MATCH_CHARS } from './whatsapp-fields';

/** Lowercase, without accents and with the spacing collapsed. */
export function normalizeWaText(text: string): string {
  return text
    .slice(0, MAX_WA_MATCH_CHARS)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when `keyword` shows up in `text` as a whole word. */
export function matchesKeyword(text: string, keyword: string): boolean {
  const needle = normalizeWaText(keyword);

  if (needle.length === 0) {
    return false;
  }

  const words = normalizeWaText(text)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0);
  const parts = needle.split(/[^a-z0-9]+/).filter((part) => part.length > 0);

  if (parts.length === 0) {
    return false;
  }

  for (let start = 0; start + parts.length <= words.length; start += 1) {
    if (parts.every((part, offset) => words[start + offset] === part)) {
      return true;
    }
  }

  return false;
}

export function matchesContains(text: string, needle: string): boolean {
  const cleaned = normalizeWaText(needle);

  return cleaned.length > 0 && normalizeWaText(text).includes(cleaned);
}

/**
 * Tests a regex the gestor typed. A pattern that does not compile never matches,
 * so a bad rule cannot break the attendance.
 */
export function matchesRegex(text: string, pattern: string): boolean {
  if (pattern.trim().length === 0) {
    return false;
  }

  try {
    return new RegExp(pattern, 'i').test(text.slice(0, MAX_WA_MATCH_CHARS));
  } catch {
    return false;
  }
}

/** Variables a message of the bot or a quick reply may carry. */
export interface WaTextVariables {
  nome?: string;
  numero?: string;
  atendente?: string;
  empresa?: string;
}

/** Replaces `{nome}` and friends; an unknown variable is left untouched. */
export function renderWaText(text: string, variables: WaTextVariables): string {
  return text.replace(/\{([a-zA-Z]+)\}/g, (whole, name: string) => {
    const value = variables[name.toLowerCase() as keyof WaTextVariables];

    return value === undefined ? whole : value;
  });
}
