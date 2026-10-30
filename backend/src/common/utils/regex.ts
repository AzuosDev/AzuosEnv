const SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;

/** Escapes user input used inside a Mongo `$regex` search. */
export function escapeRegex(value: string): string {
  return value.replace(SPECIAL_CHARACTERS, '\\$&');
}
