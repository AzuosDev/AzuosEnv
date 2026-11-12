import { TargetType } from './goals-fields';

export interface TargetProgressInput {
  type: TargetType;
  start: number;
  target: number;
  current: number;
}

/** Rounds to two decimals so the percentage travels as a clean number. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * How much of the target is done, from 0 to 100. A boolean target is all or
 * nothing; the others measure how far `current` walked from `start` to `target`.
 */
export function targetPercent(input: TargetProgressInput): number {
  if (input.type === 'boolean') {
    return input.current >= (input.target || 1) ? 100 : 0;
  }

  const span = input.target - input.start;

  if (span === 0) {
    return input.current >= input.target ? 100 : 0;
  }

  const walked = (input.current - input.start) / span;

  return round(Math.min(1, Math.max(0, walked)) * 100);
}

/** Progress of the goal: the plain average of the progress of its targets. */
export function goalPercent(targets: TargetProgressInput[]): number {
  if (targets.length === 0) {
    return 0;
  }

  const total = targets.reduce((sum, target) => sum + targetPercent(target), 0);

  return round(total / targets.length);
}
