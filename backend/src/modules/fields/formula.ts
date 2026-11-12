import { MAX_FORMULA_LENGTH } from './custom-field-types';

/** Resolves `{ref}` to a number; a missing or non-numeric reference returns null. */
export type FormulaResolver = (ref: string) => number | null;

interface Reader {
  text: string;
  at: number;
}

/**
 * Evaluates `+ - * /` and parentheses over numeric fields with a hand written
 * recursive descent parser. `eval` is never used; anything invalid returns null.
 */
export function evaluateFormula(expression: string, resolve: FormulaResolver): number | null {
  if (!expression || expression.length > MAX_FORMULA_LENGTH) {
    return null;
  }

  const reader: Reader = { text: expression, at: 0 };
  const value = readSum(reader, resolve);

  skipSpaces(reader);

  if (value === null || reader.at < reader.text.length) {
    return null;
  }

  return Number.isFinite(value) ? value : null;
}

/** References used by the expression, in order of appearance. */
export function formulaRefs(expression: string): string[] {
  return [...expression.matchAll(/\{([^{}]*)\}/g)].map((match) => match[1].trim());
}

/** True when the expression parses; used to validate `config.expression`. */
export function isValidFormula(expression: string): boolean {
  return evaluateFormula(expression, () => 1) !== null;
}

function readSum(reader: Reader, resolve: FormulaResolver): number | null {
  let left = readProduct(reader, resolve);

  while (left !== null) {
    const operator = readOperator(reader, ['+', '-']);

    if (!operator) {
      return left;
    }

    const right = readProduct(reader, resolve);

    if (right === null) {
      return null;
    }

    left = operator === '+' ? left + right : left - right;
  }

  return left;
}

function readProduct(reader: Reader, resolve: FormulaResolver): number | null {
  let left = readUnary(reader, resolve);

  while (left !== null) {
    const operator = readOperator(reader, ['*', '/']);

    if (!operator) {
      return left;
    }

    const right = readUnary(reader, resolve);

    if (right === null || (operator === '/' && right === 0)) {
      return null;
    }

    left = operator === '*' ? left * right : left / right;
  }

  return left;
}

function readUnary(reader: Reader, resolve: FormulaResolver): number | null {
  const sign = readOperator(reader, ['-', '+']) === '-' ? -1 : 1;
  const value = readPrimary(reader, resolve);

  return value === null ? null : sign * value;
}

function readPrimary(reader: Reader, resolve: FormulaResolver): number | null {
  skipSpaces(reader);

  const char = reader.text[reader.at];

  if (char === '(') {
    reader.at += 1;

    const value = readSum(reader, resolve);

    skipSpaces(reader);

    if (value === null || reader.text[reader.at] !== ')') {
      return null;
    }

    reader.at += 1;

    return value;
  }

  if (char === '{') {
    const end = reader.text.indexOf('}', reader.at);

    if (end === -1) {
      return null;
    }

    const ref = reader.text.slice(reader.at + 1, end).trim();

    reader.at = end + 1;

    return resolve(ref);
  }

  const number = /^\d+(\.\d+)?/.exec(reader.text.slice(reader.at));

  if (!number) {
    return null;
  }

  reader.at += number[0].length;

  return Number(number[0]);
}

function readOperator(reader: Reader, operators: string[]): string | null {
  skipSpaces(reader);

  const char = reader.text[reader.at];

  if (char && operators.includes(char)) {
    reader.at += 1;

    return char;
  }

  return null;
}

function skipSpaces(reader: Reader): void {
  while (reader.text[reader.at] === ' ') {
    reader.at += 1;
  }
}
