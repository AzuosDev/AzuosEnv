import { describe, expect, it } from 'vitest';
import type { WorkspaceTree } from '@/api/types';
import { applyDropPlan, flattenTree, planDrop } from './tree-dnd';

function list(id: string, name = id) {
  return { id, name, position: 'a0', openTaskCount: 0 };
}

function folder(id: string, lists: ReturnType<typeof list>[] = [], folders: unknown[] = []) {
  return { id, name: id, private: false, position: 'a0', folders, lists };
}

const tree = {
  spaces: [
    {
      id: 's1',
      name: 'Clientes',
      color: '#2563EB',
      private: false,
      position: 'a0',
      folders: [folder('f1', [list('l1'), list('l2')]), folder('f2', [list('l3')])],
      lists: [list('l4')],
    },
    {
      id: 's2',
      name: 'Comercial',
      color: '#16A34A',
      private: false,
      position: 'a1',
      folders: [],
      lists: [list('l5')],
    },
  ],
} as unknown as WorkspaceTree;

const all = () => true;

describe('flattenTree', () => {
  it('achata só o que está expandido, com profundidade e pai de cada linha', () => {
    const rows = flattenTree(tree, all);

    expect(rows.map((row) => row.id)).toEqual([
      's1',
      'f1',
      'l1',
      'l2',
      'f2',
      'l3',
      'l4',
      's2',
      'l5',
    ]);
    expect(rows.find((row) => row.id === 'l1')).toMatchObject({
      kind: 'list',
      spaceId: 's1',
      folderId: 'f1',
      depth: 2,
    });
    expect(rows.find((row) => row.id === 'l4')).toMatchObject({ folderId: null, depth: 1 });
  });

  it('não desce em nó recolhido', () => {
    const rows = flattenTree(tree, (id) => id !== 'f1');

    expect(rows.map((row) => row.id)).toEqual(['s1', 'f1', 'f2', 'l3', 'l4', 's2', 'l5']);
  });
});

describe('planDrop', () => {
  const rows = flattenTree(tree, all);

  it('move a List para outro Folder e a põe no lugar do irmão', () => {
    const plan = planDrop(rows, 'l1', 'l3');

    expect(plan).toMatchObject({
      kind: 'list',
      id: 'l1',
      move: { spaceId: 's1', folderId: 'f2' },
      previousId: undefined,
      nextId: 'l3',
    });
  });

  it('solta a List em cima do Folder e manda para o fim dele', () => {
    const plan = planDrop(rows, 'l4', 'f1');

    expect(plan).toMatchObject({
      move: { spaceId: 's1', folderId: 'f1' },
      previousId: 'l2',
      nextId: undefined,
    });
  });

  it('reordena sem mover quando o pai é o mesmo', () => {
    const plan = planDrop(rows, 'l1', 'l2');

    expect(plan).toMatchObject({ move: null, previousId: 'l2', nextId: undefined });
  });

  it('leva a List para outro Space pela raiz', () => {
    const plan = planDrop(rows, 'l1', 's2');

    expect(plan).toMatchObject({ move: { spaceId: 's2', folderId: null }, previousId: 'l5' });
  });

  it('reordena Space com Space', () => {
    expect(planDrop(rows, 's2', 's1')).toMatchObject({
      kind: 'space',
      move: null,
      nextId: 's1',
    });
  });

  it('não faz nada quando o item cai onde já estava', () => {
    expect(planDrop(rows, 'l1', 'l1')).toBeNull();
    // l2 já é a última List de f1; soltar no próprio Folder manda para o fim.
    expect(planDrop(rows, 'l2', 'f1')).toBeNull();
  });

  it('não deixa o Folder cair dentro de si mesmo', () => {
    const nested = flattenTree(
      {
        spaces: [
          {
            id: 's1',
            name: 'Clientes',
            color: '#2563EB',
            private: false,
            position: 'a0',
            folders: [folder('f1', [], [folder('f1a', [list('l9')])])],
            lists: [],
          },
        ],
      } as unknown as WorkspaceTree,
      all,
    );

    expect(planDrop(nested, 'f1', 'l9')).toBeNull();
  });
});

describe('applyDropPlan', () => {
  it('tira a List do Folder antigo e põe no novo', () => {
    const rows = flattenTree(tree, all);
    const plan = planDrop(rows, 'l1', 'l3');
    const next = applyDropPlan(tree, plan!);
    const [f1, f2] = next.spaces[0]?.folders ?? [];

    expect(f1?.lists.map((item) => item.id)).toEqual(['l2']);
    expect(f2?.lists.map((item) => item.id)).toEqual(['l1', 'l3']);
  });

  it('reordena os Spaces', () => {
    const rows = flattenTree(tree, all);
    const plan = planDrop(rows, 's2', 's1');

    expect(applyDropPlan(tree, plan!).spaces.map((space) => space.id)).toEqual(['s2', 's1']);
  });
});
