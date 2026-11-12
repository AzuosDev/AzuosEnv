import { describe, expect, it } from 'vitest';
import type { MyTasksSections, Task } from '@/api/types';
import { countMyTasks, listIdsOf, sectionsOf } from './my-tasks-model';

function task(id: string, listId = 'l1'): Task {
  return { id, customId: `AZD-${id}`, name: `Tarefa ${id}`, listId } as Task;
}

const sections: MyTasksSections = {
  overdue: [task('1')],
  today: [],
  next7: [task('2', 'l2'), task('3')],
  later: [],
  noDate: [task('4', 'l2')],
};

describe('sectionsOf', () => {
  it('mantém a ordem fixa e descarta as seções vazias', () => {
    expect(sectionsOf(sections).map((section) => section.key)).toEqual([
      'overdue',
      'next7',
      'noDate',
    ]);
  });

  it('dá tom de perigo ao atraso e de alerta ao hoje', () => {
    const full = sectionsOf({ ...sections, today: [task('5')] });

    expect(full[0]?.tone).toBe('text-danger');
    expect(full[1]?.tone).toBe('text-warning');
  });

  it('devolve vazio sem seções', () => {
    expect(sectionsOf(undefined)).toEqual([]);
  });
});

describe('countMyTasks', () => {
  it('soma as tarefas de todas as seções', () => {
    expect(countMyTasks(sections)).toBe(4);
    expect(countMyTasks(undefined)).toBe(0);
  });
});

describe('listIdsOf', () => {
  it('junta as Lists sem repetir', () => {
    expect(listIdsOf(sections)).toEqual(['l1', 'l2']);
  });
});
