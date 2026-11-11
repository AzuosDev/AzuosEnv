import type { DocPage, MovePageInput } from '@/api/types';

/** Profundidade máxima da árvore de páginas, igual à do backend. */
export const MAX_PAGE_DEPTH = 5;

export interface PageNode {
  page: DocPage;
  depth: number;
  children: PageNode[];
}

/** Linha achatada da árvore, na ordem em que a lateral desenha. */
export interface PageRow {
  page: DocPage;
  depth: number;
  hasChildren: boolean;
}

function parentIdOf(page: DocPage): string | null {
  const parent = page.parentPageId as unknown;

  return typeof parent === 'string' && parent !== '' ? parent : null;
}

/**
 * Monta a árvore por parentPageId. A API já devolve as irmãs em ordem manual,
 * então a ordem de `items` é a ordem de cada nível.
 */
export function buildPageTree(items: DocPage[]): PageNode[] {
  const nodes = new Map<string, PageNode>();

  for (const page of items) {
    nodes.set(page.id, { page, depth: 0, children: [] });
  }

  const roots: PageNode[] = [];

  for (const page of items) {
    const node = nodes.get(page.id);

    if (!node) {
      continue;
    }

    const parentId = parentIdOf(page);
    const parent = parentId === null ? undefined : nodes.get(parentId);

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const stamp = (list: PageNode[], depth: number): void => {
    for (const node of list) {
      node.depth = depth;
      stamp(node.children, depth + 1);
    }
  };

  stamp(roots, 0);

  return roots;
}

/** Achata a árvore, escondendo os filhos das páginas recolhidas. */
export function flattenTree(roots: PageNode[], collapsed: ReadonlySet<string>): PageRow[] {
  const rows: PageRow[] = [];

  const walk = (list: PageNode[]): void => {
    for (const node of list) {
      rows.push({ page: node.page, depth: node.depth, hasChildren: node.children.length > 0 });

      if (!collapsed.has(node.page.id)) {
        walk(node.children);
      }
    }
  };

  walk(roots);

  return rows;
}

/** Caminho da raiz até a página, para a trilha do cabeçalho. */
export function pagePath(items: DocPage[], pageId: string): DocPage[] {
  const byId = new Map(items.map((page) => [page.id, page]));
  const path: DocPage[] = [];
  let current = byId.get(pageId);

  while (current) {
    path.unshift(current);

    const parentId = parentIdOf(current);

    current = parentId === null ? undefined : byId.get(parentId);

    if (path.length > MAX_PAGE_DEPTH + 1) {
      break;
    }
  }

  return path;
}

/** Altura da subárvore da página, usada para barrar um aninhamento fundo demais. */
export function subtreeDepth(roots: PageNode[], pageId: string): number {
  const find = (list: PageNode[]): PageNode | null => {
    for (const node of list) {
      if (node.page.id === pageId) {
        return node;
      }

      const found = find(node.children);

      if (found) {
        return found;
      }
    }

    return null;
  };

  const height = (node: PageNode): number =>
    node.children.length === 0 ? 1 : 1 + Math.max(...node.children.map(height));
  const node = find(roots);

  return node ? height(node) : 1;
}

/** Ids da página e de tudo que está aninhado nela: um pai não entra no filho. */
export function subtreeIds(roots: PageNode[], pageId: string): Set<string> {
  const ids = new Set<string>();

  const collect = (node: PageNode): void => {
    ids.add(node.page.id);
    node.children.forEach(collect);
  };

  const find = (list: PageNode[]): void => {
    for (const node of list) {
      if (node.page.id === pageId) {
        collect(node);

        return;
      }

      find(node.children);
    }
  };

  find(roots);

  return ids;
}

export type DropPosition = 'before' | 'after' | 'inside';

export interface PageDrop {
  activeId: string;
  overId: string;
  position: DropPosition;
}

/**
 * Traduz o arraste da lateral no corpo do /pages/:id/move. Devolve null quando
 * o movimento é inválido (sobre si mesma, dentro da própria subárvore ou fundo
 * demais) ou quando nada mudaria de lugar.
 */
export function planPageMove(
  items: DocPage[],
  drop: PageDrop,
): (MovePageInput & { pageId: string }) | null {
  if (drop.activeId === drop.overId) {
    return null;
  }

  const roots = buildPageTree(items);
  const blocked = subtreeIds(roots, drop.activeId);

  if (blocked.has(drop.overId)) {
    return null;
  }

  const byId = new Map(items.map((page) => [page.id, page]));
  const over = byId.get(drop.overId);
  const active = byId.get(drop.activeId);

  if (!over || !active) {
    return null;
  }

  const overPath = pagePath(items, drop.overId);
  const parentDepth = drop.position === 'inside' ? overPath.length : overPath.length - 1;

  if (parentDepth + subtreeDepth(roots, drop.activeId) > MAX_PAGE_DEPTH) {
    return null;
  }

  const parentPageId = drop.position === 'inside' ? drop.overId : (parentIdOf(over) ?? null);
  const siblings = items.filter(
    (page) => parentIdOf(page) === parentPageId && page.id !== drop.activeId,
  );

  if (drop.position === 'inside') {
    const last = siblings[siblings.length - 1];

    return { pageId: drop.activeId, parentPageId, previousId: last?.id };
  }

  const index = siblings.findIndex((page) => page.id === drop.overId);

  if (index === -1) {
    return null;
  }

  const previous = drop.position === 'before' ? siblings[index - 1] : siblings[index];
  const next = drop.position === 'before' ? siblings[index] : siblings[index + 1];

  if (previous?.id === drop.activeId || next?.id === drop.activeId) {
    return null;
  }

  if (parentIdOf(active) === parentPageId) {
    const current = items.filter((page) => parentIdOf(page) === parentPageId);
    const from = current.findIndex((page) => page.id === drop.activeId);
    const to = current.findIndex((page) => page.id === drop.overId);

    if (from !== -1 && to !== -1) {
      const target = drop.position === 'before' ? to : to + 1;

      if (target === from || target === from + 1) {
        return null;
      }
    }
  }

  return {
    pageId: drop.activeId,
    parentPageId,
    previousId: previous?.id,
    nextId: next?.id,
  };
}
