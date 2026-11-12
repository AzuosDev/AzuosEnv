import { MAX_PROPOSED_TASKS } from './ai-fields';
import { validateTaskProposal } from './ai-task-proposal';

describe('validateTaskProposal', () => {
  it('aceita a proposta e normaliza a data', () => {
    const result = validateTaskProposal({
      tasks: [
        {
          name: '  Corrigir fechamento de caixa  ',
          priority: 'high',
          type: 'bug',
          dueAt: '2026-11-06T12:00:00.000Z',
          estimateMinutes: 90,
          points: 3,
        },
      ],
    });

    expect(result.warnings).toEqual([]);
    expect(result.tasks).toEqual([
      {
        name: 'Corrigir fechamento de caixa',
        priority: 'high',
        type: 'bug',
        dueAt: '2026-11-06T12:00:00.000Z',
        estimateMinutes: 90,
        points: 3,
      },
    ]);
  });

  it('descarta o campo inválido e avisa', () => {
    const result = validateTaskProposal({
      tasks: [{ name: 'Revisar relatório', priority: 'critical', dueAt: 'sexta' }],
    });

    expect(result.tasks).toEqual([{ name: 'Revisar relatório' }]);
    expect(result.warnings).toHaveLength(2);
  });

  it('descarta a tarefa sem nome', () => {
    const result = validateTaskProposal({ tasks: [{ name: '   ' }, { name: 'Ok' }] });

    expect(result.tasks).toEqual([{ name: 'Ok' }]);
    expect(result.warnings).toHaveLength(1);
  });

  it('não devolve nada quando o JSON não tem a lista', () => {
    expect(validateTaskProposal({ itens: [] }).tasks).toEqual([]);
    expect(validateTaskProposal(null).tasks).toEqual([]);
  });

  it('corta a proposta no limite', () => {
    const tasks = Array.from({ length: MAX_PROPOSED_TASKS + 3 }, (_one, index) => ({
      name: `Tarefa ${index}`,
    }));
    const result = validateTaskProposal({ tasks });

    expect(result.tasks).toHaveLength(MAX_PROPOSED_TASKS);
    expect(result.warnings).toHaveLength(1);
  });
});
