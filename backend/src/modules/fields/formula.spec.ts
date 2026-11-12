import { evaluateFormula, formulaRefs, isValidFormula } from './formula';

describe('evaluateFormula', () => {
  const values: Record<string, number> = { Horas: 10, Valor: 2.5, Zero: 0 };
  const resolve = (ref: string): number | null => values[ref] ?? null;

  it('respeita precedência e parênteses', () => {
    expect(evaluateFormula('2 + 3 * 4', resolve)).toBe(14);
    expect(evaluateFormula('(2 + 3) * 4', resolve)).toBe(20);
  });

  it('lê campos numéricos pelo nome', () => {
    expect(evaluateFormula('{Horas} * {Valor}', resolve)).toBe(25);
    expect(evaluateFormula('-{Horas} + 1', resolve)).toBe(-9);
  });

  it('devolve null em referência ausente, divisão por zero e sintaxe inválida', () => {
    expect(evaluateFormula('{Outro} * 2', resolve)).toBeNull();
    expect(evaluateFormula('{Horas} / {Zero}', resolve)).toBeNull();
    expect(evaluateFormula('2 +', resolve)).toBeNull();
    expect(evaluateFormula('process.exit(1)', resolve)).toBeNull();
  });

  it('lista as referências e valida a expressão', () => {
    expect(formulaRefs('{Horas} * {Valor} + 1')).toEqual(['Horas', 'Valor']);
    expect(isValidFormula('{a} + {b}')).toBe(true);
    expect(isValidFormula('{a} +')).toBe(false);
  });
});
