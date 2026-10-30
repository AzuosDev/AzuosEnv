import { Transform } from 'class-transformer';

/** Reads `a,b` and repeated query params as a list of non-empty strings. */
export function toStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const items = Array.isArray(value) ? value : String(value).split(',');

  return items.map((item) => String(item).trim()).filter((item) => item.length > 0);
}

/** Query parameter that accepts a comma-separated list or repeated keys. */
export const ToStringArray = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => toStringArray(value));
