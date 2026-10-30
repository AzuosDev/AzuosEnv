import { Types } from 'mongoose';

const MAX_MENTION_DEPTH = 20;

/**
 * User ids mentioned in the editor JSON. The editor writes mentions as nodes
 * `{ type: 'mention', attrs: { id } }`; anything else in the tree is ignored.
 */
export function extractMentions(body: unknown): Types.ObjectId[] {
  const ids = new Set<string>();

  collect(body, ids, 0);

  return [...ids].map((id) => new Types.ObjectId(id));
}

function collect(node: unknown, ids: Set<string>, depth: number): void {
  if (depth > MAX_MENTION_DEPTH || node === null || typeof node !== 'object') {
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collect(item, ids, depth + 1);
    }

    return;
  }

  const record = node as Record<string, unknown>;

  if (record.type === 'mention') {
    const id = mentionId(record.attrs);

    if (id) {
      ids.add(id);
    }
  }

  for (const value of Object.values(record)) {
    collect(value, ids, depth + 1);
  }
}

function mentionId(attrs: unknown): string | null {
  if (attrs === null || typeof attrs !== 'object') {
    return null;
  }

  const id = (attrs as Record<string, unknown>).id;

  return typeof id === 'string' && Types.ObjectId.isValid(id) ? id : null;
}
