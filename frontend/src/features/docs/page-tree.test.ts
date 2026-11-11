import { describe, expect, it } from 'vitest';
import type { DocPage } from '@/api/types';
import {
  buildPageTree,
  flattenTree,
  pagePath,
  planPageMove,
  subtreeDepth,
  subtreeIds,
} from './page-tree';

function page(id: string, parentPageId: string | null, position: string): DocPage {
  return {
    id,
    parentPageId,
    position,
    title: `Página ${id}`,
    content: null,
    contentText: '',
    mentionedTaskIds: [],
    version: 1,
    docId: 'doc',
    workspaceId: 'ws',
    updatedBy: 'user',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as unknown as DocPage;
}

/** a › (b › d, c) e e, na ordem que a API devolve. */
const items = [
  page('a', null, 'a0'),
  page('b', 'a', 'a0'),
  page('d', 'b', 'a0'),
  page('c', 'a', 'a1'),
  page('e', null, 'a1'),
];

describe('buildPageTree', () => {
  it('aninha por parentPageId e marca a profundidade', () => {
    const roots = buildPageTree(items);

    expect(roots.map((node) => node.page.id)).toEqual(['a', 'e']);
    expect(roots[0]?.children.map((node) => node.page.id)).toEqual(['b', 'c']);
    expect(roots[0]?.children[0]?.children[0]?.depth).toBe(2);
  });

  it('esconde os filhos da página recolhida', () => {
    const rows = flattenTree(buildPageTree(items), new Set(['a']));

    expect(rows.map((row) => row.page.id)).toEqual(['a', 'e']);
    expect(rows[0]?.hasChildren).toBe(true);
  });
});

describe('pagePath', () => {
  it('vai da raiz até a página', () => {
    expect(pagePath(items, 'd').map((item) => item.id)).toEqual(['a', 'b', 'd']);
  });
});

describe('subtree', () => {
  it('mede a altura e junta os ids aninhados', () => {
    const roots = buildPageTree(items);

    expect(subtreeDepth(roots, 'a')).toBe(3);
    expect(subtreeDepth(roots, 'e')).toBe(1);
    expect([...subtreeIds(roots, 'a')].sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('planPageMove', () => {
  it('aninha a página na página de destino', () => {
    const move = planPageMove(items, { activeId: 'e', overId: 'b', position: 'inside' });

    expect(move).toEqual({ pageId: 'e', parentPageId: 'b', previousId: 'd' });
  });

  it('reordena entre irmãs', () => {
    const move = planPageMove(items, { activeId: 'c', overId: 'b', position: 'before' });

    expect(move).toEqual({ pageId: 'c', parentPageId: 'a', previousId: undefined, nextId: 'b' });
  });

  it('recusa soltar dentro da própria subárvore', () => {
    expect(planPageMove(items, { activeId: 'a', overId: 'd', position: 'inside' })).toBeNull();
    expect(planPageMove(items, { activeId: 'a', overId: 'a', position: 'inside' })).toBeNull();
  });

  it('recusa o movimento que não muda nada', () => {
    expect(planPageMove(items, { activeId: 'c', overId: 'b', position: 'after' })).toBeNull();
  });

  it('recusa passar da profundidade máxima', () => {
    const deep = [
      page('n1', null, 'a0'),
      page('n2', 'n1', 'a0'),
      page('n3', 'n2', 'a0'),
      page('n4', 'n3', 'a0'),
      page('t1', null, 'a1'),
      page('t2', 't1', 'a0'),
    ];

    expect(planPageMove(deep, { activeId: 't1', overId: 'n4', position: 'inside' })).toBeNull();
    expect(planPageMove(deep, { activeId: 't1', overId: 'n3', position: 'inside' })).not.toBeNull();
  });
});
