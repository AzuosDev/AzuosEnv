import { matchesCondition, visibleFieldIds } from './form-conditions';

describe('form-conditions', () => {
  it('compara a resposta com o valor da condição', () => {
    expect(
      matchesCondition({ fieldId: 'f1', op: 'eq', value: 'bug', showFieldIds: [] }, 'bug'),
    ).toBe(true);
    expect(
      matchesCondition(
        { fieldId: 'f1', op: 'contains', value: 'pdv', showFieldIds: [] },
        'Erro PDV',
      ),
    ).toBe(true);
    expect(matchesCondition({ fieldId: 'f1', op: 'gt', value: 10, showFieldIds: [] }, 4)).toBe(
      false,
    );
    expect(matchesCondition({ fieldId: 'f1', op: 'isEmpty', showFieldIds: [] }, [])).toBe(true);
  });

  it('esconde o campo condicional até a condição bater', () => {
    const conditions = [
      { fieldId: 'tipo', op: 'eq' as const, value: 'bug', showFieldIds: ['passos'] },
    ];

    expect([...visibleFieldIds(['tipo', 'passos'], conditions, { tipo: 'ideia' })]).toEqual([
      'tipo',
    ]);
    expect([...visibleFieldIds(['tipo', 'passos'], conditions, { tipo: 'bug' })]).toEqual([
      'tipo',
      'passos',
    ]);
  });

  it('mantém visível o campo que nenhuma condição governa', () => {
    expect([...visibleFieldIds(['nome'], [], {})]).toEqual(['nome']);
  });
});
