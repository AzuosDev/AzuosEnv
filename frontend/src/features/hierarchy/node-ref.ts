import type { TreeLocation } from '@/features/shell/tree-path';
import type { FlatNode } from './tree-dnd';

/**
 * Referência de um nó da hierarquia (o mesmo formato que a árvore achatada usa),
 * montada a partir do que o /tree sabe sobre o item aberto.
 */
export function refFromLocation(location: TreeLocation): FlatNode {
  const folder = [...location.trail].reverse().find((crumb) => crumb.kind === 'folder');

  return {
    id: location.id,
    kind: location.kind,
    name: location.name,
    depth: location.trail.length,
    spaceId: location.trail[0]?.id ?? location.id,
    folderId: folder?.id ?? null,
  };
}
