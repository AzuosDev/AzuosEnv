import { describe, expect, it } from 'vitest';
import type { WorkspaceTree } from '@/api/types';
import { ancestorIds, crumbsOf, findLocation } from './tree-path';

const tree: WorkspaceTree = {
  spaces: [
    {
      id: 'sp1',
      name: 'Clientes',
      color: '#2563EB',
      private: false,
      position: 'a0',
      lists: [{ id: 'li-solta', name: 'Avulsa', position: 'a0', openTaskCount: 0 }],
      folders: [
        {
          id: 'fo1',
          name: 'Cênio Construções',
          private: false,
          position: 'a0',
          lists: [{ id: 'li1', name: 'Sprint 3', position: 'a0', openTaskCount: 8 }],
          folders: [
            {
              id: 'fo2',
              name: 'Arquivo',
              private: false,
              position: 'a0',
              folders: [],
              lists: [{ id: 'li2', name: 'Sprint 2', position: 'a0', openTaskCount: 0 }],
            },
          ],
        },
      ],
    },
  ],
};

describe('findLocation', () => {
  it('acha a List dentro do Folder com a trilha completa', () => {
    const found = findLocation(tree, 'list', 'li1');

    expect(found?.name).toBe('Sprint 3');
    expect(found?.openTaskCount).toBe(8);
    expect(ancestorIds(found)).toEqual(['sp1', 'fo1']);
  });

  it('acha a List do subfolder', () => {
    expect(ancestorIds(findLocation(tree, 'list', 'li2'))).toEqual(['sp1', 'fo1', 'fo2']);
  });

  it('acha a List solta no Space', () => {
    expect(ancestorIds(findLocation(tree, 'list', 'li-solta'))).toEqual(['sp1']);
  });

  it('o Space não tem ancestrais e o Folder tem só o Space', () => {
    expect(ancestorIds(findLocation(tree, 'space', 'sp1'))).toEqual([]);
    expect(ancestorIds(findLocation(tree, 'folder', 'fo1'))).toEqual(['sp1']);
    expect(ancestorIds(findLocation(tree, 'folder', 'fo2'))).toEqual(['sp1', 'fo1']);
  });

  it('não confunde os tipos nem inventa nó', () => {
    expect(findLocation(tree, 'list', 'sp1')).toBeNull();
    expect(findLocation(tree, 'folder', 'li1')).toBeNull();
    expect(findLocation(undefined, 'space', 'sp1')).toBeNull();
  });
});

describe('crumbsOf', () => {
  it('termina no próprio nó', () => {
    const found = findLocation(tree, 'list', 'li1');

    expect(found && crumbsOf(found).map((crumb) => crumb.name)).toEqual([
      'Clientes',
      'Cênio Construções',
      'Sprint 3',
    ]);
  });
});
