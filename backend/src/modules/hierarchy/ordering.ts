import { BadRequestException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { CursorPage, buildCursorPage, decodeCursor } from '../../common/pagination/cursor';
import {
  DEFAULT_PAGE_SIZE,
  PaginationQueryDto,
} from '../../common/pagination/pagination-query.dto';
import { positionBetween } from '../../common/utils/position';

export interface Positioned {
  position: string;
}

/**
 * Pages items already filtered by permission, keeping the manual order; the
 * cursor is the position of the last item of the page.
 */
export function paginateByPosition<T extends Positioned>(
  docs: T[],
  query: PaginationQueryDto,
): CursorPage<T> {
  const limit = query.limit ?? DEFAULT_PAGE_SIZE;
  const after = query.cursor ? positionFromCursor(query.cursor) : null;
  const pending = after === null ? docs : docs.filter((doc) => doc.position > after);

  return buildCursorPage(pending.slice(0, limit + 1), limit, (doc) => ({
    position: doc.position,
  }));
}

function positionFromCursor(cursor: string): string {
  const { position } = decodeCursor(cursor);

  if (typeof position !== 'string') {
    throw new BadRequestException({ code: 'INVALID_CURSOR', message: 'Cursor inválido.' });
  }

  return position;
}

export type PositionedModel = Model<Positioned>;

/** Mongoose 9 models are not covariant, so ordering helpers take this view. */
export function positionedModel<T>(model: Model<T>): PositionedModel {
  return model as unknown as PositionedModel;
}

/** Position of a new item appended after the last sibling. */
export async function appendPosition(
  model: PositionedModel,
  siblings: Record<string, unknown>,
): Promise<string> {
  const last = await model.findOne(siblings).sort({ position: -1 }).select('position').exec();

  return positionBetween(last?.position ?? null, null);
}

/**
 * Position that puts the item between the two siblings. When only one of them is
 * given, the missing side is the sibling next to it, so the rest of the order is kept.
 */
export async function positionBetweenSiblings(
  model: PositionedModel,
  siblings: Record<string, unknown>,
  previousId: Types.ObjectId | null,
  nextId: Types.ObjectId | null,
): Promise<string> {
  const previous = previousId ? await requireSibling(model, siblings, previousId) : null;
  const next = nextId ? await requireSibling(model, siblings, nextId) : null;

  if (!previous && !next) {
    return appendPosition(model, siblings);
  }

  const before =
    previous?.position ??
    (next ? await neighbourPosition(model, siblings, next.position, -1) : null);
  const after =
    next?.position ??
    (previous ? await neighbourPosition(model, siblings, previous.position, 1) : null);

  return positionBetween(before, after);
}

async function requireSibling(
  model: PositionedModel,
  siblings: Record<string, unknown>,
  id: Types.ObjectId,
): Promise<Positioned> {
  const doc = await model
    .findOne({ ...siblings, _id: id })
    .select('position')
    .exec();

  if (!doc) {
    throw new BadRequestException({
      code: 'INVALID_POSITION',
      message: 'Referência de posição inválida.',
    });
  }

  return doc;
}

async function neighbourPosition(
  model: PositionedModel,
  siblings: Record<string, unknown>,
  position: string,
  direction: 1 | -1,
): Promise<string | null> {
  const filter =
    direction === 1
      ? { ...siblings, position: { $gt: position } }
      : { ...siblings, position: { $lt: position } };

  const doc = await model.findOne(filter).sort({ position: direction }).select('position').exec();

  return doc?.position ?? null;
}
