import { BadRequestException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  MAX_DRAWING_POINTS,
  MAX_ELEMENT_TEXT_LENGTH,
  MAX_WHITEBOARD_ELEMENTS,
  WHITEBOARD_ELEMENT_TYPES,
  WhiteboardElementType,
  WhiteboardOpKind,
} from './whiteboard-fields';

/**
 * One item on the canvas. The shape is the same for every type and the unused
 * fields stay null, so the client never has to branch on the stored document.
 */
export interface WhiteboardElement {
  id: string;
  type: WhiteboardElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string | null;
  color: string | null;
  /** Freehand stroke, as flat `x, y` pairs. */
  points: number[];
  /** Connector ends; ids of other elements. */
  from: string | null;
  to: string | null;
  /** Anything the canvas needs and the server does not read. */
  data: Record<string, unknown> | null;
  /** Set once the element has been turned into a task. */
  taskId: string | null;
}

/** Operation of a batch PATCH. */
export interface WhiteboardOp {
  op: WhiteboardOpKind;
  /** Required by `add`; carries the changed fields on `update`. */
  element?: Record<string, unknown>;
  /** Required by `update` and `remove`. */
  id?: string;
}

export function invalidElement(message: string): BadRequestException {
  return new BadRequestException({ code: 'INVALID_WHITEBOARD_ELEMENT', message });
}

export function elementNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'WHITEBOARD_ELEMENT_NOT_FOUND',
    message: 'Elemento não encontrado no quadro.',
  });
}

function asNumber(value: unknown, field: string, fallback: number): number {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw invalidElement(`O campo ${field} do elemento precisa ser um número.`);
  }

  return value;
}

function asText(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw invalidElement(`O campo ${field} do elemento precisa ser texto.`);
  }

  if (value.length > MAX_ELEMENT_TEXT_LENGTH) {
    throw invalidElement(`O campo ${field} do elemento passou de ${MAX_ELEMENT_TEXT_LENGTH}.`);
  }

  return value;
}

function asPoints(value: unknown): number[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw invalidElement('O campo points do elemento precisa ser uma lista de números.');
  }

  if (value.length > MAX_DRAWING_POINTS) {
    throw invalidElement(`Um desenho aceita no máximo ${MAX_DRAWING_POINTS} coordenadas.`);
  }

  return value.map((point, index) => asNumber(point, `points[${index}]`, 0));
}

function asData(value: unknown): Record<string, unknown> | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw invalidElement('O campo data do elemento precisa ser um objeto.');
  }

  return value as Record<string, unknown>;
}

function asElementId(value: unknown, field: string): string | null {
  const text = asText(value, field);

  return text && text.length > 0 ? text : null;
}

/** Validates a raw element and fills the defaults; `base` is the current state. */
export function normalizeElement(
  raw: Record<string, unknown>,
  base?: WhiteboardElement,
): WhiteboardElement {
  const type = raw.type ?? base?.type;

  if (typeof type !== 'string' || !(WHITEBOARD_ELEMENT_TYPES as readonly string[]).includes(type)) {
    throw invalidElement(
      `O tipo do elemento precisa ser um de: ${WHITEBOARD_ELEMENT_TYPES.join(', ')}.`,
    );
  }

  const id = asElementId(raw.id, 'id') ?? base?.id ?? randomUUID();

  return {
    id,
    type: type as WhiteboardElementType,
    x: asNumber(raw.x, 'x', base?.x ?? 0),
    y: asNumber(raw.y, 'y', base?.y ?? 0),
    width: asNumber(raw.width, 'width', base?.width ?? 0),
    height: asNumber(raw.height, 'height', base?.height ?? 0),
    text: raw.text === undefined ? (base?.text ?? null) : asText(raw.text, 'text'),
    color: raw.color === undefined ? (base?.color ?? null) : asText(raw.color, 'color'),
    points: raw.points === undefined ? (base?.points ?? []) : asPoints(raw.points),
    from: raw.from === undefined ? (base?.from ?? null) : asElementId(raw.from, 'from'),
    to: raw.to === undefined ? (base?.to ?? null) : asElementId(raw.to, 'to'),
    data: raw.data === undefined ? (base?.data ?? null) : asData(raw.data),
    taskId: base?.taskId ?? null,
  };
}

/**
 * Applies a batch of operations over the current elements and answers the new list.
 * Pure: the caller decides whether to save, and a failing operation leaves nothing
 * half-written.
 */
export function applyOps(elements: WhiteboardElement[], ops: WhiteboardOp[]): WhiteboardElement[] {
  const next = elements.map((element) => ({ ...element }));
  const indexOf = (id: string): number => next.findIndex((element) => element.id === id);

  for (const op of ops) {
    if (op.op === 'add') {
      if (!op.element) {
        throw invalidElement('A operação add exige element.');
      }

      const element = normalizeElement(op.element);

      if (indexOf(element.id) >= 0) {
        throw invalidElement(`O elemento ${element.id} já existe no quadro.`);
      }

      next.push(element);
      continue;
    }

    const id = op.id ?? (typeof op.element?.id === 'string' ? op.element.id : undefined);

    if (!id) {
      throw invalidElement(`A operação ${op.op} exige o id do elemento.`);
    }

    const at = indexOf(id);

    if (at < 0) {
      throw elementNotFound();
    }

    if (op.op === 'remove') {
      next.splice(at, 1);
      continue;
    }

    if (!op.element) {
      throw invalidElement('A operação update exige element.');
    }

    next[at] = normalizeElement({ ...op.element, id }, next[at]);
  }

  if (next.length > MAX_WHITEBOARD_ELEMENTS) {
    throw invalidElement(`Um quadro aceita no máximo ${MAX_WHITEBOARD_ELEMENTS} elementos.`);
  }

  return next;
}

/** Name of the task created from an element; falls back to the type. */
export function elementTaskName(element: WhiteboardElement): string {
  const text = (element.text ?? '').trim().replace(/\s+/g, ' ');

  if (text.length === 0) {
    return 'Item do quadro';
  }

  return text.length > 200 ? `${text.slice(0, 197)}...` : text;
}
