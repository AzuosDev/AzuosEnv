import type { WhiteboardOpKind } from '@/api/types';

/** Tipos que o servidor aceita no elemento do quadro. */
export const BOARD_ELEMENT_TYPES = ['note', 'shape', 'connector', 'text', 'drawing'] as const;
export type BoardElementType = (typeof BOARD_ELEMENT_TYPES)[number];

/** Elemento como o servidor guarda (whiteboard-elements do backend). */
export interface BoardElement {
  id: string;
  type: BoardElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string | null;
  color: string | null;
  points: number[];
  from: string | null;
  to: string | null;
  /** O elemento do Excalidraw inteiro, que o servidor não lê. */
  data: Record<string, unknown> | null;
  taskId: string | null;
}

export interface BoardOp {
  op: WhiteboardOpKind;
  id?: string;
  element?: Record<string, unknown>;
}

/** Elemento do Excalidraw, só com o que a conversão usa. */
export interface CanvasElement extends Record<string, unknown> {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  isDeleted?: boolean;
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function bindingId(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const id = (value as Record<string, unknown>).elementId;

  return typeof id === 'string' ? id : null;
}

/** Pares [x, y] do Excalidraw viram a lista plana que o servidor valida. */
function flatPoints(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((point) => (Array.isArray(point) ? [num(point[0]), num(point[1])] : []));
}

export function typeOfCanvasElement(type: string): BoardElementType {
  if (type === 'text') {
    return 'text';
  }

  if (type === 'freedraw') {
    return 'drawing';
  }

  if (type === 'arrow' || type === 'line') {
    return 'connector';
  }

  if (type === 'rectangle') {
    return 'note';
  }

  return 'shape';
}

/** Elemento do canvas no formato do servidor; o original fica em `data`. */
export function toBoardElement(element: CanvasElement): BoardElement {
  return {
    id: element.id,
    type: typeOfCanvasElement(element.type),
    x: num(element.x),
    y: num(element.y),
    width: num(element.width),
    height: num(element.height),
    text: text(element.text),
    color: text(element.strokeColor),
    points: flatPoints(element.points),
    from: bindingId(element.startBinding),
    to: bindingId(element.endBinding),
    data: { canvas: element },
    taskId: null,
  };
}

/** Volta ao formato do canvas; sem `data.canvas` monta um retângulo simples. */
export function toCanvasElement(element: BoardElement): CanvasElement {
  const stored = element.data?.canvas;

  if (typeof stored === 'object' && stored !== null && !Array.isArray(stored)) {
    const raw = stored as Record<string, unknown>;

    if (typeof raw.id === 'string' && typeof raw.type === 'string') {
      return raw as CanvasElement;
    }
  }

  return {
    id: element.id,
    type: element.type === 'text' ? 'text' : 'rectangle',
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    ...(element.text === null ? {} : { text: element.text, originalText: element.text }),
    ...(element.color === null ? {} : { strokeColor: element.color }),
  };
}

/** Lista do servidor pronta para o canvas, descartando o que não é elemento. */
export function toCanvasElements(elements: unknown[]): CanvasElement[] {
  const result: CanvasElement[] = [];

  for (const raw of elements) {
    if (typeof raw !== 'object' || raw === null) {
      continue;
    }

    const element = raw as BoardElement;

    if (typeof element.id === 'string') {
      result.push(toCanvasElement(element));
    }
  }

  return result;
}

/** Elementos vivos do canvas (o Excalidraw mantém os apagados na lista). */
export function liveElements(elements: readonly CanvasElement[]): CanvasElement[] {
  return elements.filter((element) => element.isDeleted !== true);
}

function same(a: BoardElement, b: BoardElement): boolean {
  return JSON.stringify({ ...a, taskId: null }) === JSON.stringify({ ...b, taskId: null });
}

/**
 * Lote de operações que leva o quadro de `before` para `after`. Puro: o hook
 * de salvamento só decide quando mandar.
 */
export function diffElements(before: BoardElement[], after: BoardElement[]): BoardOp[] {
  const previous = new Map(before.map((element) => [element.id, element]));
  const ops: BoardOp[] = [];

  for (const element of after) {
    const old = previous.get(element.id);

    if (!old) {
      ops.push({ op: 'add', element: { ...element } });
      continue;
    }

    if (!same(old, element)) {
      ops.push({ op: 'update', id: element.id, element: { ...element } });
    }
  }

  const current = new Set(after.map((element) => element.id));

  for (const element of before) {
    if (!current.has(element.id)) {
      ops.push({ op: 'remove', id: element.id });
    }
  }

  return ops;
}

/** Junta dois lotes mantendo a ordem; o lote novo manda no mesmo elemento. */
export function mergeOps(pending: BoardOp[], next: BoardOp[]): BoardOp[] {
  const merged = [...pending];

  for (const op of next) {
    const at = merged.findIndex(
      (item) => (item.id ?? item.element?.id) === (op.id ?? op.element?.id),
    );

    if (at < 0) {
      merged.push(op);
      continue;
    }

    const old = merged[at];

    // add seguido de update continua add; qualquer coisa seguida de remove vira remove.
    if (op.op === 'remove' && old?.op === 'add') {
      merged.splice(at, 1);
      continue;
    }

    merged[at] = old?.op === 'add' && op.op === 'update' ? { ...old, element: op.element } : op;
  }

  return merged;
}
