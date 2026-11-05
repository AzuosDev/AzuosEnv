import type { TreeFolder, TreeSpace, WorkspaceTree } from '@/api/types';

export type TreeNodeKind = 'space' | 'folder' | 'list';

export interface TreeCrumb {
  kind: TreeNodeKind;
  id: string;
  name: string;
}

/** Nó da árvore com os ancestrais, o que o breadcrumb e o título precisam. */
export interface TreeLocation extends TreeCrumb {
  /** Do Space até o pai direto. */
  trail: TreeCrumb[];
  openTaskCount: number | null;
}

function crumb(kind: TreeNodeKind, id: string, name: string): TreeCrumb {
  return { kind, id, name };
}

function fromFolder(
  folder: TreeFolder,
  trail: TreeCrumb[],
  kind: TreeNodeKind,
  id: string,
): TreeLocation | null {
  const here = [...trail, crumb('folder', folder.id, folder.name)];

  if (kind === 'folder' && folder.id === id) {
    return { ...crumb('folder', folder.id, folder.name), trail, openTaskCount: null };
  }

  if (kind === 'list') {
    const list = folder.lists.find((item) => item.id === id);

    if (list) {
      return {
        ...crumb('list', list.id, list.name),
        trail: here,
        openTaskCount: list.openTaskCount,
      };
    }
  }

  for (const child of folder.folders) {
    const found = fromFolder(child, here, kind, id);

    if (found) {
      return found;
    }
  }

  return null;
}

function fromSpace(space: TreeSpace, kind: TreeNodeKind, id: string): TreeLocation | null {
  const trail = [crumb('space', space.id, space.name)];

  if (kind === 'space' && space.id === id) {
    return { ...crumb('space', space.id, space.name), trail: [], openTaskCount: null };
  }

  if (kind === 'list') {
    const list = space.lists.find((item) => item.id === id);

    if (list) {
      return { ...crumb('list', list.id, list.name), trail, openTaskCount: list.openTaskCount };
    }
  }

  for (const folder of space.folders) {
    const found = fromFolder(folder, trail, kind, id);

    if (found) {
      return found;
    }
  }

  return null;
}

/** Acha o Space, o Folder ou a List na árvore; null quando não está visível. */
export function findLocation(
  tree: WorkspaceTree | undefined,
  kind: TreeNodeKind,
  id: string,
): TreeLocation | null {
  for (const space of tree?.spaces ?? []) {
    const found = fromSpace(space, kind, id);

    if (found) {
      return found;
    }
  }

  return null;
}

/** Breadcrumb pronto para a tela: ancestrais mais o próprio nó. */
export function crumbsOf(location: TreeLocation): TreeCrumb[] {
  return [...location.trail, crumb(location.kind, location.id, location.name)];
}

/** Ids dos ancestrais, para a árvore abrir sozinha no item ativo. */
export function ancestorIds(location: TreeLocation | null): string[] {
  return (location?.trail ?? []).map((item) => item.id);
}
