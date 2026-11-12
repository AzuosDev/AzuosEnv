import type { TreeFolder, TreeList, TreeSpace, WorkspaceTree } from '@/api/types';
import type { TreeNodeKind } from '@/features/shell/tree-path';

/** Linha arrastável da árvore, já achatada na ordem em que aparece na tela. */
export interface FlatNode {
  id: string;
  kind: TreeNodeKind;
  name: string;
  depth: number;
  /** Space que contém o nó; no próprio Space é o seu id. */
  spaceId: string;
  /** Folder que contém o nó direto; null na raiz do Space. */
  folderId: string | null;
}

/** Onde o nó vai morar depois do drop. */
export interface DropTarget {
  spaceId: string;
  folderId: string | null;
}

export interface DropPlan {
  kind: TreeNodeKind;
  id: string;
  /** Presente só quando o pai muda. */
  move: DropTarget | null;
  previousId: string | undefined;
  nextId: string | undefined;
}

/** Achata a árvore visível: só entra o que está dentro de um nó expandido. */
export function flattenTree(tree: WorkspaceTree, isExpanded: (id: string) => boolean): FlatNode[] {
  const rows: FlatNode[] = [];

  const pushFolder = (folder: TreeFolder, spaceId: string, parentFolderId: string | null): void => {
    rows.push({
      id: folder.id,
      kind: 'folder',
      name: folder.name,
      depth: parentFolderId ? 2 : 1,
      spaceId,
      folderId: parentFolderId,
    });

    if (!isExpanded(folder.id)) {
      return;
    }

    for (const child of folder.folders) {
      pushFolder(child, spaceId, folder.id);
    }

    for (const list of folder.lists) {
      pushList(list, spaceId, folder.id, parentFolderId ? 3 : 2);
    }
  };

  const pushList = (
    list: TreeList,
    spaceId: string,
    folderId: string | null,
    depth: number,
  ): void => {
    rows.push({ id: list.id, kind: 'list', name: list.name, depth, spaceId, folderId });
  };

  for (const space of tree.spaces) {
    rows.push({
      id: space.id,
      kind: 'space',
      name: space.name,
      depth: 0,
      spaceId: space.id,
      folderId: null,
    });

    if (!isExpanded(space.id)) {
      continue;
    }

    for (const folder of space.folders) {
      pushFolder(folder, space.id, null);
    }

    for (const list of space.lists) {
      pushList(list, space.id, null, 1);
    }
  }

  return rows;
}

/** Os Spaces são todos irmãos; Folders e Lists dependem do pai. */
function sameTarget(node: FlatNode, target: DropTarget): boolean {
  return (
    node.kind === 'space' || (node.spaceId === target.spaceId && node.folderId === target.folderId)
  );
}

/** Folders de um Folder, do mais próximo ao mais externo. */
function folderAncestors(nodes: FlatNode[], folderId: string | null): string[] {
  const chain: string[] = [];
  let current = folderId;

  while (current) {
    chain.push(current);
    current = nodes.find((node) => node.id === current)?.folderId ?? null;
  }

  return chain;
}

/** Casa de destino do nó arrastado, a partir da linha sob o cursor. */
function targetOf(nodes: FlatNode[], active: FlatNode, over: FlatNode): DropTarget | null {
  if (active.kind === 'space') {
    return { spaceId: over.spaceId, folderId: null };
  }

  if (active.kind === 'list') {
    return over.kind === 'folder'
      ? { spaceId: over.spaceId, folderId: over.id }
      : { spaceId: over.spaceId, folderId: over.folderId };
  }

  // Folder: só a raiz do Space ou dentro de um Folder de primeiro nível.
  const candidate = over.folderId;
  const parentIsRoot =
    candidate === null || nodes.find((node) => node.id === candidate)?.folderId === null;
  const folderId = parentIsRoot ? candidate : null;

  if (folderId !== null && folderAncestors(nodes, folderId).includes(active.id)) {
    return null;
  }

  return { spaceId: over.spaceId, folderId };
}

/**
 * Traduz "arrastei A para cima de B" em mover (pai) + reordenar (vizinhos).
 * Devolve null quando o drop não muda nada ou não é permitido.
 */
export function planDrop(
  nodes: FlatNode[],
  activeId: string,
  overId: string,
): (DropPlan & { target: DropTarget; index: number }) | null {
  const active = nodes.find((node) => node.id === activeId);
  const over = nodes.find((node) => node.id === overId);

  if (!active || !over || activeId === overId) {
    return null;
  }

  const target = targetOf(nodes, active, over);

  if (!target) {
    return null;
  }

  const siblings = nodes.filter(
    (node) => node.kind === active.kind && node.id !== active.id && sameTarget(node, target),
  );

  const overIndex = siblings.findIndex((node) => node.id === over.id);
  const activeRow = nodes.findIndex((node) => node.id === active.id);
  const overRow = nodes.findIndex((node) => node.id === over.id);

  const moved = active.kind !== 'space' && !sameTarget(active, target);

  // Em cima de um irmão entra no lugar dele; em cima do pai vai para o fim.
  const index =
    overIndex < 0 ? siblings.length : !moved && activeRow < overRow ? overIndex + 1 : overIndex;

  if (!moved) {
    const current = nodes
      .filter((node) => node.kind === active.kind && sameTarget(node, target))
      .findIndex((node) => node.id === active.id);

    if (current === index) {
      return null;
    }
  }

  const previous = siblings[index - 1];
  const next = siblings[index];

  return {
    kind: active.kind,
    id: active.id,
    move: moved ? target : null,
    previousId: previous?.id,
    nextId: next?.id,
    target,
    index,
  };
}

/* Atualização otimista da árvore ---------------------------------------- */

type Node = TreeSpace | TreeFolder | TreeList;

function removeNode(tree: WorkspaceTree, kind: TreeNodeKind, id: string): [WorkspaceTree, Node?] {
  let taken: Node | undefined;

  const pruneFolder = (folder: TreeFolder): TreeFolder => ({
    ...folder,
    folders: folder.folders
      .filter((child) => {
        if (kind === 'folder' && child.id === id) {
          taken = child;

          return false;
        }

        return true;
      })
      .map(pruneFolder),
    lists: folder.lists.filter((list) => {
      if (kind === 'list' && list.id === id) {
        taken = list;

        return false;
      }

      return true;
    }),
  });

  const spaces = tree.spaces
    .filter((space) => {
      if (kind === 'space' && space.id === id) {
        taken = space;

        return false;
      }

      return true;
    })
    .map((space) => ({
      ...space,
      folders: space.folders
        .filter((folder) => {
          if (kind === 'folder' && folder.id === id) {
            taken = folder;

            return false;
          }

          return true;
        })
        .map(pruneFolder),
      lists: space.lists.filter((list) => {
        if (kind === 'list' && list.id === id) {
          taken = list;

          return false;
        }

        return true;
      }),
    }));

  return [{ spaces }, taken];
}

function insertAt<T>(items: T[], item: T, index: number): T[] {
  const next = [...items];

  next.splice(Math.max(0, Math.min(index, next.length)), 0, item);

  return next;
}

function insertIntoFolder(
  folder: TreeFolder,
  target: DropTarget,
  kind: TreeNodeKind,
  node: Node,
  index: number,
): TreeFolder {
  if (folder.id === target.folderId) {
    return kind === 'folder'
      ? { ...folder, folders: insertAt(folder.folders, node as TreeFolder, index) }
      : { ...folder, lists: insertAt(folder.lists, node as TreeList, index) };
  }

  return {
    ...folder,
    folders: folder.folders.map((child) => insertIntoFolder(child, target, kind, node, index)),
  };
}

/** Aplica o drop na árvore do cache, para a tela responder antes da API. */
export function applyDropPlan(
  tree: WorkspaceTree,
  plan: DropPlan & { target: DropTarget; index: number },
): WorkspaceTree {
  const [pruned, node] = removeNode(tree, plan.kind, plan.id);

  if (!node) {
    return tree;
  }

  if (plan.kind === 'space') {
    return { spaces: insertAt(pruned.spaces, node as TreeSpace, plan.index) };
  }

  return {
    spaces: pruned.spaces.map((space) => {
      if (space.id !== plan.target.spaceId) {
        return space;
      }

      if (plan.target.folderId === null) {
        return plan.kind === 'folder'
          ? { ...space, folders: insertAt(space.folders, node as TreeFolder, plan.index) }
          : { ...space, lists: insertAt(space.lists, node as TreeList, plan.index) };
      }

      return {
        ...space,
        folders: space.folders.map((folder) =>
          insertIntoFolder(folder, plan.target, plan.kind, node, plan.index),
        ),
      };
    }),
  };
}
