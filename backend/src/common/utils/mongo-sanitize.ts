/**
 * Removes the keys a Mongo filter would read as an operator (`$gt`, `$where`) or as
 * a path into a subdocument (`a.b`) from anything that comes from the outside.
 *
 * Only keys are dropped: strings, numbers and dates keep their value, so a task
 * named `R$ 10` or a Mixed value with a dotted *value* still arrive untouched.
 */
export function sanitizeMongoInput<T>(input: T): T {
  return sanitize(input, 0) as T;
}

/** Keys of a plain object are only trusted when they are neither operators nor paths. */
export function isSafeMongoKey(key: string): boolean {
  return !key.startsWith('$') && !key.includes('.');
}

const MAX_DEPTH = 20;

function sanitize(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, depth + 1));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const source = value as Record<string, unknown>;

  for (const key of Object.keys(source)) {
    if (!isSafeMongoKey(key)) {
      delete source[key];

      continue;
    }

    source[key] = sanitize(source[key], depth + 1);
  }

  return source;
}

/**
 * Buffers, Dates, ObjectIds, streams and class instances are left alone: only the
 * literal objects produced by the body/query parsers are walked.
 */
function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value) as object | null;

  return prototype === Object.prototype || prototype === null;
}
