import { BadRequestException } from '@nestjs/common';
import { buildCursorPage, decodeCursor, encodeCursor } from './cursor';

describe('cursor pagination', () => {
  it('encodes and decodes a payload', () => {
    const payload = { id: '507f1f77bcf86cd799439011', position: 1.5 };
    expect(decodeCursor(encodeCursor(payload))).toEqual(payload);
  });

  it('produces url-safe cursors', () => {
    const cursor = encodeCursor({ id: 'aaaa++//bbbb', position: 2 });
    expect(cursor).not.toMatch(/[+/=]/);
  });

  it('rejects an invalid cursor', () => {
    expect(() => decodeCursor('not-a-cursor')).toThrow(BadRequestException);
  });

  it('returns nextCursor when there are more documents than the limit', () => {
    const docs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const page = buildCursorPage(docs, 2, (doc) => ({ id: doc.id }));

    expect(page.items).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(page.nextCursor).not.toBeNull();
    expect(decodeCursor(page.nextCursor as string)).toEqual({ id: 'b' });
  });

  it('returns a null nextCursor on the last page', () => {
    const docs = [{ id: 'a' }];
    expect(buildCursorPage(docs, 2, (doc) => ({ id: doc.id }))).toEqual({
      items: docs,
      nextCursor: null,
    });
  });

  it('returns a null nextCursor for an empty page', () => {
    expect(buildCursorPage<{ id: string }>([], 10, (doc) => ({ id: doc.id }))).toEqual({
      items: [],
      nextCursor: null,
    });
  });
});
