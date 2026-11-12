import { describe, expect, it } from 'vitest';
import type { GoalFolder, GoalTarget, GoalView } from '@/api/types';
import {
  canWriteGoal,
  dueFromInput,
  dueInputValue,
  formatTargetValue,
  goalPercent,
  groupGoals,
  isManualTarget,
  nextValue,
  percentLabel,
  progressTone,
  stepOf,
  targetPercent,
} from './goal-model';

function target(partial: Partial<GoalTarget>): GoalTarget {
  return {
    id: 't1',
    workspaceId: 'w1',
    goalId: 'g1',
    name: 'Alvo',
    type: 'number',
    start: 0,
    target: 100,
    current: 0,
    unit: null,
    taskIds: [],
    listId: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...partial,
  } as GoalTarget;
}

function view(partial: Partial<GoalView['goal']>, targets: GoalTarget[] = []): GoalView {
  return {
    goal: {
      id: 'g1',
      workspaceId: 'w1',
      folderId: null,
      name: 'Meta',
      description: null,
      ownerIds: [],
      dueDate: null,
      color: '#2563EB',
      private: false,
      completedAt: null,
      createdBy: 'u1',
      deletedAt: null,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      ...partial,
    } as GoalView['goal'],
    targets,
    progress: goalPercent(targets),
  };
}

describe('targetPercent', () => {
  it('mede o caminho de start até target', () => {
    expect(targetPercent(target({ start: 0, target: 10, current: 5 }))).toBe(50);
    expect(targetPercent(target({ start: 10, target: 20, current: 15 }))).toBe(50);
  });

  it('nunca passa de 100 nem fica negativo', () => {
    expect(targetPercent(target({ current: 500 }))).toBe(100);
    expect(targetPercent(target({ start: 10, target: 20, current: 0 }))).toBe(0);
  });

  it('sim/não é tudo ou nada', () => {
    expect(targetPercent(target({ type: 'boolean', target: 1, current: 0 }))).toBe(0);
    expect(targetPercent(target({ type: 'boolean', target: 1, current: 1 }))).toBe(100);
  });

  it('alvo sem intervalo só conta quando chega', () => {
    expect(targetPercent(target({ start: 5, target: 5, current: 4 }))).toBe(0);
    expect(targetPercent(target({ start: 5, target: 5, current: 5 }))).toBe(100);
  });
});

describe('goalPercent', () => {
  it('é a média dos alvos', () => {
    expect(
      goalPercent([target({ current: 100 }), target({ type: 'boolean', target: 1, current: 0 })]),
    ).toBe(50);
  });

  it('meta sem alvo fica em zero', () => {
    expect(goalPercent([])).toBe(0);
  });
});

describe('tom e rótulo', () => {
  it('o tom acompanha o progresso', () => {
    expect(progressTone(0)).toBe('danger');
    expect(progressTone(30)).toBe('warning');
    expect(progressTone(70)).toBe('accent');
    expect(progressTone(100)).toBe('success');
  });

  it('o percentual vai arredondado', () => {
    expect(percentLabel(33.33)).toBe('33%');
  });
});

describe('formatTargetValue', () => {
  it('número leva a unidade', () => {
    expect(formatTargetValue(target({ current: 12, target: 20, unit: 'horas' }))).toBe(
      '12 de 20 horas',
    );
  });

  it('moeda vai em real', () => {
    expect(
      formatTargetValue(target({ type: 'currency', current: 1500, target: 10_000 })),
    ).toContain('R$');
  });

  it('tarefas conta as tarefas e sim/não diz feito', () => {
    expect(formatTargetValue(target({ type: 'tasks', current: 3, target: 8 }))).toBe(
      '3 de 8 tarefas',
    );
    expect(formatTargetValue(target({ type: 'boolean', target: 1, current: 1 }))).toBe('Feito');
  });
});

describe('passo e próximo valor', () => {
  it('o passo é um décimo do caminho', () => {
    expect(stepOf(target({ start: 0, target: 100 }))).toBe(10);
    expect(stepOf(target({ start: 0, target: 5 }))).toBe(1);
  });

  it('o valor não passa do alvo nem do começo', () => {
    expect(nextValue(target({ current: 95 }), 10)).toBe(100);
    expect(nextValue(target({ current: 5 }), -10)).toBe(0);
  });

  it('alvo de tarefas não se digita', () => {
    expect(isManualTarget(target({ type: 'tasks' }))).toBe(false);
    expect(isManualTarget(target({ type: 'currency' }))).toBe(true);
  });
});

describe('permissão e pastas', () => {
  it('o autor e os donos escrevem a meta', () => {
    expect(canWriteGoal({ createdBy: 'u1', ownerIds: [] }, 'u1')).toBe(true);
    expect(canWriteGoal({ createdBy: 'u1', ownerIds: ['u2'] }, 'u2')).toBe(true);
    expect(canWriteGoal({ createdBy: 'u1', ownerIds: [] }, 'u3')).toBe(false);
  });

  it('as metas se agrupam por pasta, com "Sem pasta" no fim', () => {
    const folders = [
      { id: 'f1', name: 'Metas 2026' },
      { id: 'f2', name: 'Vazia' },
    ] as GoalFolder[];
    const groups = groupGoals(
      [view({ folderId: 'f1' }), view({ id: 'g2', folderId: null })],
      folders,
    );

    expect(groups).toHaveLength(3);
    expect(groups[0]?.folder?.id).toBe('f1');
    expect(groups[1]?.goals).toHaveLength(0);
    expect(groups[2]?.folder).toBeNull();
  });
});

describe('prazo', () => {
  it('o input mostra o dia e volta ao meio-dia local', () => {
    const iso = dueFromInput('2026-12-31');

    expect(iso).not.toBeNull();
    expect(dueInputValue({ dueDate: iso })).toBe('2026-12-31');
    expect(dueFromInput('')).toBeNull();
  });
});
