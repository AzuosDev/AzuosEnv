import { applyOps, elementTaskName, normalizeElement } from './whiteboard-elements';

describe('whiteboard-elements', () => {
  const note = { id: 'n1', type: 'note', x: 10, y: 20, text: 'Ajustar PDV' };

  describe('normalizeElement', () => {
    it('fills the defaults and keeps the extra data of the canvas', () => {
      const element = normalizeElement({ ...note, data: { font: 'mono' } });

      expect(element).toMatchObject({
        id: 'n1',
        type: 'note',
        x: 10,
        y: 20,
        width: 0,
        height: 0,
        text: 'Ajustar PDV',
        points: [],
        from: null,
        to: null,
        data: { font: 'mono' },
        taskId: null,
      });
    });

    it('generates an id when the client does not send one', () => {
      expect(normalizeElement({ type: 'text' }).id).toHaveLength(36);
    });

    it('refuses an unknown type', () => {
      expect(() => normalizeElement({ type: 'hologram' })).toThrow(/tipo do elemento/);
    });

    it('refuses a coordinate that is not a number', () => {
      expect(() => normalizeElement({ type: 'note', x: '10' })).toThrow(/campo x/);
    });
  });

  describe('applyOps', () => {
    it('adds, updates and removes without touching the input', () => {
      const elements = [normalizeElement(note)];
      const next = applyOps(elements, [
        { op: 'add', element: { id: 'c1', type: 'connector', from: 'n1', to: 'n2' } },
        { op: 'update', id: 'n1', element: { x: 99 } },
      ]);

      expect(next).toHaveLength(2);
      expect(next[0]).toMatchObject({ id: 'n1', x: 99, text: 'Ajustar PDV' });
      expect(next[1]).toMatchObject({ id: 'c1', type: 'connector', from: 'n1', to: 'n2' });
      expect(elements[0].x).toBe(10);

      expect(applyOps(next, [{ op: 'remove', id: 'c1' }])).toHaveLength(1);
    });

    it('keeps the type of an element on a partial update', () => {
      const next = applyOps(
        [normalizeElement(note)],
        [{ op: 'update', id: 'n1', element: { text: 'Novo texto' } }],
      );

      expect(next[0]).toMatchObject({ type: 'note', text: 'Novo texto' });
    });

    it('refuses to add an id that already exists', () => {
      expect(() => applyOps([normalizeElement(note)], [{ op: 'add', element: note }])).toThrow(
        /já existe/,
      );
    });

    it('answers not found for an element out of the board', () => {
      expect(() => applyOps([], [{ op: 'update', id: 'ghost', element: { text: 'x' } }])).toThrow(
        /Elemento não encontrado/,
      );
    });

    it('exige o id em update e remove', () => {
      expect(() => applyOps([], [{ op: 'remove' }])).toThrow(/exige o id/);
    });
  });

  describe('elementTaskName', () => {
    it('uses the text of the element, collapsed', () => {
      expect(elementTaskName(normalizeElement({ type: 'note', text: ' Subir   PDV ' }))).toBe(
        'Subir PDV',
      );
    });

    it('falls back when the element has no text', () => {
      expect(elementTaskName(normalizeElement({ type: 'shape' }))).toBe('Item do quadro');
    });
  });
});
