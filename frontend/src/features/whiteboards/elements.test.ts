import { describe, expect, it } from 'vitest';
import {
  diffElements,
  liveElements,
  mergeOps,
  toBoardElement,
  toCanvasElement,
  toCanvasElements,
  typeOfCanvasElement,
  type CanvasElement,
} from './elements';

const canvas = (over: Partial<CanvasElement> = {}): CanvasElement => ({
  id: 'e1',
  type: 'rectangle',
  x: 10,
  y: 20,
  width: 100,
  height: 50,
  strokeColor: 'rgb(167 139 250)',
  text: 'Ideia',
  ...over,
});

describe('typeOfCanvasElement', () => {
  it('traduz os tipos do canvas para os do servidor', () => {
    expect(typeOfCanvasElement('rectangle')).toBe('note');
    expect(typeOfCanvasElement('text')).toBe('text');
    expect(typeOfCanvasElement('freedraw')).toBe('drawing');
    expect(typeOfCanvasElement('arrow')).toBe('connector');
    expect(typeOfCanvasElement('ellipse')).toBe('shape');
  });
});

describe('toBoardElement', () => {
  it('guarda o elemento do canvas em data e achata os pontos', () => {
    const element = toBoardElement(
      canvas({
        type: 'freedraw',
        points: [
          [0, 0],
          [3, 4],
        ],
        startBinding: { elementId: 'a' },
        endBinding: { elementId: 'b' },
      }),
    );

    expect(element.type).toBe('drawing');
    expect(element.points).toEqual([0, 0, 3, 4]);
    expect(element.from).toBe('a');
    expect(element.to).toBe('b');
    expect(element.text).toBe('Ideia');
    expect(element.data).toEqual({ canvas: expect.objectContaining({ id: 'e1' }) });
  });
});

describe('toCanvasElement', () => {
  it('volta o elemento original quando ele está em data', () => {
    const original = canvas();

    expect(toCanvasElement(toBoardElement(original))).toEqual(original);
  });

  it('monta um retângulo quando o quadro veio de outro cliente', () => {
    const element = toCanvasElement({
      id: 'e9',
      type: 'note',
      x: 1,
      y: 2,
      width: 3,
      height: 4,
      text: 'Nota',
      color: null,
      points: [],
      from: null,
      to: null,
      data: null,
      taskId: null,
    });

    expect(element).toMatchObject({ id: 'e9', type: 'rectangle', text: 'Nota' });
  });

  it('ignora o que não é elemento na lista do servidor', () => {
    expect(toCanvasElements([null, 'x', { id: 'e1', type: 'note', data: null }])).toHaveLength(1);
  });
});

describe('liveElements', () => {
  it('descarta os apagados', () => {
    expect(liveElements([canvas(), canvas({ id: 'e2', isDeleted: true })])).toHaveLength(1);
  });
});

describe('diffElements', () => {
  it('vê o que entrou, o que mudou e o que saiu', () => {
    const a = toBoardElement(canvas());
    const b = toBoardElement(canvas({ id: 'e2' }));
    const moved = toBoardElement(canvas({ x: 99 }));

    expect(diffElements([a, b], [moved])).toEqual([
      { op: 'update', id: 'e1', element: expect.objectContaining({ x: 99 }) },
      { op: 'remove', id: 'e2' },
    ]);
    expect(diffElements([], [a])).toEqual([
      { op: 'add', element: expect.objectContaining({ id: 'e1' }) },
    ]);
    expect(diffElements([a], [a])).toEqual([]);
  });
});

describe('mergeOps', () => {
  it('mantém add quando vem um update e cancela o add removido', () => {
    const add = { op: 'add' as const, element: { id: 'e1', x: 0 } };
    const update = { op: 'update' as const, id: 'e1', element: { id: 'e1', x: 5 } };

    expect(mergeOps([add], [update])).toEqual([{ op: 'add', element: { id: 'e1', x: 5 } }]);
    expect(mergeOps([add], [{ op: 'remove', id: 'e1' }])).toEqual([]);
    expect(mergeOps([update], [{ op: 'remove', id: 'e1' }])).toEqual([{ op: 'remove', id: 'e1' }]);
  });
});
