import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

export interface CursorPayload {
  [key: string]: string | number;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): CursorPayload {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('invalid cursor payload');
    }
    return parsed as CursorPayload;
  } catch {
    throw new BadRequestException({ code: 'INVALID_CURSOR', message: 'Cursor inválido.' });
  }
}

/**
 * Receives up to `limit + 1` documents and returns the page plus the cursor for the next one.
 */
export function buildCursorPage<T>(
  docs: T[],
  limit: number,
  toCursorPayload: (doc: T) => CursorPayload,
): CursorPage<T> {
  const hasMore = docs.length > limit;
  const items = hasMore ? docs.slice(0, limit) : docs;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last !== undefined ? encodeCursor(toCursorPayload(last)) : null,
  };
}

/** Reads an ObjectId cursor produced by `encodeCursor({ id })`. */
export function decodeObjectIdCursor(cursor: string): Types.ObjectId {
  const { id } = decodeCursor(cursor);

  if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
    throw new BadRequestException({ code: 'INVALID_CURSOR', message: 'Cursor inválido.' });
  }

  return new Types.ObjectId(id);
}

/**
 * Pages items already filtered by permission, newest first; the cursor is the id
 * of the last item of the page.
 */
export function paginateByIdDesc<T extends { _id: Types.ObjectId }>(
  docs: T[],
  limit: number,
  cursor?: string,
): CursorPage<T> {
  const after = cursor ? String(decodeObjectIdCursor(cursor)) : null;
  const pending = after === null ? docs : docs.filter((doc) => String(doc._id) < after);

  return buildCursorPage(pending.slice(0, limit + 1), limit, (doc) => ({ id: String(doc._id) }));
}
