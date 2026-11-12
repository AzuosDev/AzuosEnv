import { goalPercent, targetPercent } from './goal-progress';

describe('goal-progress', () => {
  it('mede o caminho andado entre o início e o alvo', () => {
    expect(targetPercent({ type: 'number', start: 0, target: 10, current: 4 })).toBe(40);
    expect(targetPercent({ type: 'currency', start: 1000, target: 5000, current: 3000 })).toBe(50);
  });

  it('trava o resultado entre 0 e 100', () => {
    expect(targetPercent({ type: 'number', start: 0, target: 10, current: -3 })).toBe(0);
    expect(targetPercent({ type: 'number', start: 0, target: 10, current: 25 })).toBe(100);
  });

  it('trata o alvo booleano como tudo ou nada', () => {
    expect(targetPercent({ type: 'boolean', start: 0, target: 1, current: 0 })).toBe(0);
    expect(targetPercent({ type: 'boolean', start: 0, target: 1, current: 1 })).toBe(100);
  });

  it('conta as tarefas fechadas sobre o total do alvo', () => {
    expect(targetPercent({ type: 'tasks', start: 0, target: 2, current: 1 })).toBe(50);
    expect(targetPercent({ type: 'tasks', start: 0, target: 0, current: 0 })).toBe(100);
  });

  it('a meta é a média dos alvos e zero sem alvo', () => {
    expect(goalPercent([])).toBe(0);
    expect(
      goalPercent([
        { type: 'tasks', start: 0, target: 2, current: 1 },
        { type: 'boolean', start: 0, target: 1, current: 1 },
      ]),
    ).toBe(75);
  });
});
