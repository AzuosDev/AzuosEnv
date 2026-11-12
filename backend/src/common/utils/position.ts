import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';
import { BadRequestException } from '@nestjs/common';

/**
 * Manual ordering uses fractional indexing: moving an item only rewrites its own
 * position, never the whole sibling list.
 */
export function positionBetween(previous: string | null, next: string | null): string {
  try {
    return generateKeyBetween(previous, next);
  } catch {
    throw new BadRequestException({
      code: 'INVALID_POSITION',
      message: 'Referência de posição inválida.',
    });
  }
}

/** Positions for `count` new items appended after `last`. */
export function positionsAfter(last: string | null, count: number): string[] {
  return generateNKeysBetween(last, null, count);
}
