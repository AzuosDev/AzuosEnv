import { createsCycle, dependencyEdge } from './dependency-graph';

describe('dependencyEdge', () => {
  it('aponta do bloqueador para o bloqueado', () => {
    expect(dependencyEdge('a', 'b', 'waiting_on')).toEqual({ from: 'b', to: 'a' });
    expect(dependencyEdge('a', 'b', 'blocking')).toEqual({ from: 'a', to: 'b' });
  });

  it('não gera direção para linked', () => {
    expect(dependencyEdge('a', 'b', 'linked')).toBeNull();
  });
});

describe('createsCycle', () => {
  it('aceita uma cadeia linear', () => {
    const existing = [{ from: 'a', to: 'b' }];

    expect(createsCycle(existing, { from: 'b', to: 'c' })).toBe(false);
  });

  it('rejeita o retorno direto', () => {
    expect(createsCycle([{ from: 'a', to: 'b' }], { from: 'b', to: 'a' })).toBe(true);
  });

  it('rejeita o ciclo indireto', () => {
    const existing = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ];

    expect(createsCycle(existing, { from: 'c', to: 'a' })).toBe(true);
  });

  it('rejeita a auto-referência', () => {
    expect(createsCycle([], { from: 'a', to: 'a' })).toBe(true);
  });

  it('termina mesmo com ciclo já gravado', () => {
    const existing = [
      { from: 'b', to: 'c' },
      { from: 'c', to: 'b' },
    ];

    expect(createsCycle(existing, { from: 'a', to: 'b' })).toBe(false);
  });
});
